import mqtt, { MqttClient } from 'mqtt';
import { Logger } from '../logs/logger';
import { WSServer } from '../ws/websocket.server';

interface IMQTTBroker {
    connect(): void;
    subscribe(topic: string): void;
    publish(topic: string, message: string): void;
}

type MQTTBrokerDeps = {
    host: string;
    ws: WSServer;
}

type SessionSummaryPayload = {
    session_id: number;
    sensors_triggered: number;
    order_ok: boolean;
    interpolated_sensors?: number[];
    trigger_order: number[];
    timestamps_us: number[];
    intervals_us: number[];
    velocities_ms: number[];
    accelerations_ms2: number[] | string;
}

type SensorEventPayload = {
    session_id: number;
    sensor_index: number;
    gpio: number;
    trigger_sequence: number;
    timestamp_us: number;
    interpolated?: boolean;
}

export class MQTTBroker implements IMQTTBroker {
    private client: MqttClient | null = null;
    private host: string;
    private ws: WSServer;

    constructor(private deps: MQTTBrokerDeps) {
        this.host = deps.host;
        this.ws = deps.ws;
    }

    public connect(): void {
        Logger.mqtt(`[MQTT] Intentando conectar a ${this.host}`);

        this.client = mqtt.connect(this.host, {
            clientId: `backend_node_${Math.random().toString(16).substring(2, 8)}`,
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
        });

        this.client.on('connect', () => {
            // borra el error de conexión
            Logger.clearLiveSlot("mqtt-error");
            Logger.mqtt('[MQTT] Conectado exitosamente al broker');

            this.subscribe('esp32/#');
        });

        this.client.on('message', (topic, message) => {
            const topicName = topic.toString().trim();
            const payload = message.toString();

            if (topicName.includes('session/summary')) {
                Logger.mqtt(`[MQTT] Raw session/summary en [${topicName}] (${payload.length} bytes)`);
                this.handleSessionSummaryMessage(payload);
                return;
            }

            if (topicName.endsWith('sensor/event')) {
                this.handleSensorsMessage(payload);
                return;
            }

            if (topicName.endsWith('status')) {
                this.handleStatusMessage(payload);
                return;
            }

            if (topicName.endsWith('commands')) {
                return;
            }

            Logger.warn(`[MQTT] Tópico no gestionado: ${topicName}`);
        });

        this.client.on('error', (error) => {
            Logger.error(`[MQTT] Error de conexión: ${error}`, { live: { key: "mqtt-error", lines: 1 } });
        });

        this.client.on('offline', () => {
            Logger.error(`[MQTT] Cliente desconectado (offline): ${this.host}`, { live: { key: "mqtt-offline", lines: 1 } });
        });
    }

    public subscribe(topic: string): void {
        if (this.client) {
            this.client.subscribe(topic, (err) => {
                if (!err) {
                    Logger.mqtt(`[MQTT] Suscrito al tópico: ${topic}`);
                } else {
                    Logger.error(`[MQTT] Error al suscribirse a ${topic}:`);
                }
            });
        }
    }

    public publish(topic: string, message: string): void {
        if (this.client) {
            this.client.publish(topic, message, (err) => {
                if (err) {
                    Logger.error(`[MQTT] Error al publicar en ${topic}: ${err}`);
                } else {
                    Logger.mqtt(`[MQTT] Mensaje publicado en ${topic}: ${message}`);
                }
            });
        } else {
            Logger.error('[MQTT] No se puede publicar, cliente desconectado');
        }
    }

    private handleStatusMessage(raw: string): void {
        let isOnline = false;
        let source = 'unknown';
        try {
            const data = JSON.parse(raw) as { status?: string; source?: string };
            isOnline = data.status === 'online';
            source = data.source ?? 'status';
        } catch {
            isOnline = raw.includes('online');
        }
        Logger.mqtt(`[MQTT] Estado ESP32: ${isOnline ? 'online' : 'offline'} (${source})`, { live: { key: "esp-status", lines: 1 } });
        this.ws.emitMessage<{ online: boolean; source?: string }>('status', { online: isOnline, source });
    }

    private handleSessionSummaryMessage(raw: string): void {
        try {
            const data = JSON.parse(raw) as SessionSummaryPayload;
            this.normalizeSummaryPayload(data);

            Logger.mqtt(
                `[MQTT] session/summary — id=${data.session_id} ` +
                `sensores=${data.sensors_triggered} orden_ok=${data.order_ok} ` +
                `trigger_order=[${(data.trigger_order ?? []).join(',')}]`
            );
            Logger.mqtt(`[MQTT] session/summary — intervals_us=${JSON.stringify(data.intervals_us)}`);
            Logger.mqtt(`[MQTT] session/summary — velocities_ms=${JSON.stringify(data.velocities_ms)}`);
            Logger.mqtt(`[MQTT] session/summary — accelerations_ms2=${JSON.stringify(data.accelerations_ms2)}`);

            this.ws.emitMessage<SessionSummaryPayload>('session/summary', data);
        } catch (err) {
            Logger.error(`[MQTT] Error al parsear session/summary: ${err}`);
            Logger.error(`[MQTT] Payload crudo session/summary: ${raw}`);
        }
    }

    private normalizeSummaryPayload(data: SessionSummaryPayload): void {
        if (typeof data.accelerations_ms2 === 'string') {
            data.accelerations_ms2 = JSON.parse(data.accelerations_ms2) as number[];
        }
    }

    private handleSensorsMessage(raw: string): void {
        try {
            const data = JSON.parse(raw) as SensorEventPayload;
            Logger.mqtt(
                `[MQTT] sensor/event — sesión=${data.session_id} S${data.sensor_index} ` +
                `sec=${data.trigger_sequence} t=${data.timestamp_us}µs`
            );
            this.ws.emitMessage<SensorEventPayload>('sensor/event', data);
        } catch (err) {
            Logger.error(`[MQTT] Error al parsear sensor/event: ${err}`);
            Logger.error(`[MQTT] Payload crudo sensor/event: ${raw}`);
        }
    }

}
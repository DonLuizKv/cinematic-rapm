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
            Logger.mqtt('[MQTT] Conectado exitosamente al broker');

            // aqui se cambiarán los eventos
            this.subscribe('esp32/telemetry');
            this.subscribe('esp32/status');
        });

        this.client.on('message', (topic, message) => {
            Logger.mqtt(`[MQTT] Mensaje recibido en [${topic}]: ${message.toString()}`);
            this.handleMessage(topic, message.toString());
        });

        this.client.on('error', (error) => {
            Logger.error(`[MQTT] Error de conexión: ${error.message}`);
        });

        this.client.on('offline', () => {
            Logger.error(`[MQTT] Cliente desconectado (offline): ${this.host}`);
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

    private handleMessage(topic: string, message: string): void {
        // Lógica para manejar mensajes según el tópico
        if (topic === 'esp32/telemetry') {
            try {
                const data = JSON.parse(message);
                Logger.mqtt(`[MQTT] Telemetría del ESP32: ${JSON.stringify(data)}`);
                console.log("hola", data);
                this.ws.emitMessage<object>('telemetry', data);
            } catch (e) {
                Logger.mqtt(`[MQTT] Telemetría del ESP32 (texto): ${message}`);
                console.log("adios", message);
                this.ws.emitMessage<object>('telemetry', { data: message });
            }
        } else if (topic === 'esp32/status') {
            Logger.mqtt(`[MQTT] Estado del ESP32: ${message}`);
            this.ws.emitMessage<object>('status', { data: message });
        }
    }
}
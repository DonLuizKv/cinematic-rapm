import mqtt, { MqttClient } from 'mqtt';
import { emitTelemetry } from './ws';

class MQTTBroker {
    private client: MqttClient | null = null;
    private host: string;

    constructor() {
        // En Docker usamos mqtt-broker, localmente localhost
        this.host = process.env.MQTT_HOST ? `mqtt://${process.env.MQTT_HOST}` : 'mqtt://localhost';
    }

    public connect(): void {
        console.log(`[MQTT] Intentando conectar a ${this.host}...`);

        this.client = mqtt.connect(this.host, {
            clientId: `backend_node_${Math.random().toString(16).substring(2, 8)}`,
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000,
        });

        this.client.on('connect', () => {
            console.log('✅ [MQTT] Conectado exitosamente al broker');

            // Suscribirse a tópicos iniciales
            this.subscribe('esp32/telemetry');
            this.subscribe('esp32/status');
        });

        this.client.on('message', (topic, message) => {
            console.log(`📩 [MQTT] Mensaje recibido en [${topic}]: ${message.toString()}`);
            this.handleMessage(topic, message.toString());
        });

        this.client.on('error', (error) => {
            console.error('❌ [MQTT] Error de conexión:', error);
        });

        this.client.on('offline', () => {
            console.log('⚠️ [MQTT] Cliente desconectado (offline)');
        });
    }

    public subscribe(topic: string): void {
        if (this.client) {
            this.client.subscribe(topic, (err) => {
                if (!err) {
                    console.log(`📡 [MQTT] Suscrito al tópico: ${topic}`);
                } else {
                    console.error(`❌ [MQTT] Error al suscribirse a ${topic}:`, err);
                }
            });
        }
    }

    public publish(topic: string, message: string): void {
        if (this.client) {
            this.client.publish(topic, message, (err) => {
                if (err) {
                    console.error(`❌ [MQTT] Error al publicar en ${topic}:`, err);
                } else {
                    console.log(`📤 [MQTT] Mensaje publicado en ${topic}: ${message}`);
                }
            });
        } else {
            console.error('[MQTT] No se puede publicar, cliente desconectado');
        }
    }

    private handleMessage(topic: string, message: string): void {
        // Lógica para manejar mensajes según el tópico
        if (topic === 'esp32/telemetry') {
            try {
                const data = JSON.parse(message);
                console.log('[App] Telemetría del ESP32:', data);
                // Emitir a todos los clientes web conectados
                emitTelemetry({ topic, data });
            } catch (e) {
                console.log('[App] Telemetría (texto):', message);
                emitTelemetry({ topic, data: message });
            }
        } else if (topic === 'esp32/status') {
            console.log('[App] Estado del ESP32:', message);
            emitTelemetry({ topic, data: message });
        }
    }
}

export const mqttBroker = new MQTTBroker();

import type { MQTTBroker } from "../../providers/mqtt/broker";

export class Esp32Service {
    constructor(
        private mqttBroker: MQTTBroker
    ) { }

    async sendCommand(command: string, value: any) {
        const payload = JSON.stringify({ command, value: value ?? null });
        this.mqttBroker.publish('esp32/commands', payload);
    }
}
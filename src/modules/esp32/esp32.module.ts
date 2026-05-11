import type { MQTTBroker } from "../../providers/mqtt/broker";
import { Router } from 'express';
import { Esp32Service } from "./esp32.service";
import { Esp32Controller } from "./esp32.controller";
import { createEsp32Routes } from "./esp32.routes";

interface Esp32ModuleConfig {
    mqttBroker: MQTTBroker;
}

export class Esp32Module {
    static create(dependences: Esp32ModuleConfig): Router {
        const service = new Esp32Service(dependences.mqttBroker);
        const controller = new Esp32Controller(service);

        const router = createEsp32Routes(controller);

        return router;
    }
}
import http from "http";
import { ExpressServer } from "./providers/express/express.server";
import { WSServer } from "./providers/ws/websocket.server";
import { MQTTBroker } from "./providers/mqtt/broker";

export async function loadExpress(origins: string[], mqttBroker: MQTTBroker) {
    const express = new ExpressServer({
        origins: origins,
        mqttBroker: mqttBroker
    });
    express.setup();
    return express;
}

export async function loadHttpServer(express: ExpressServer) {
    const httpServer = http.createServer(express.getApp());
    return httpServer;
}

export async function loadWebSockets(httpServer: http.Server) {
    const webSockets = WSServer.getInstance(httpServer);
    webSockets.initialize();
    return webSockets;
}

export async function loadMQTTBroker(host: string, ws: WSServer) {
    const mqttBroker = new MQTTBroker({
        host: host,
        ws: ws
    });
    mqttBroker.connect();
    return mqttBroker;
}


import http from "http";
import { Logger } from "./providers/logs/logger";
import { ExpressServer } from "./providers/express/express.server";
import { WSServer } from "./providers/ws/websocket.server";
import { loadExpress, loadHttpServer, loadMQTTBroker, loadWebSockets } from "./loaders";
import { MQTTBroker } from "./providers/mqtt/broker";

type RampDeps = {
    port: number;
    origins: string[];
    mqttHost: string;
}

interface IRamp {
    load(): Promise<void>;
    start(): void;
    stop(): void;
}

export class Ramp implements IRamp {
    private expressServer!: ExpressServer;
    private httpServer: http.Server = http.createServer();
    private sockets!: WSServer;
    private mqqtBroker!: MQTTBroker;

    constructor(private deps: RampDeps) { }

    public async load(): Promise<void> {
        this.expressServer = await loadExpress(this.deps.origins, this.mqqtBroker);
        this.httpServer = await loadHttpServer(this.expressServer);
        this.sockets = await loadWebSockets(this.httpServer);
        this.mqqtBroker = await loadMQTTBroker(this.deps.mqttHost, this.sockets);
    }

    public start(): void {
        this.httpServer.listen(this.deps.port, () => {
            Logger.info(`Ramp backend running on port ${this.deps.port}`);
        });
    }

    public async stop(): Promise<void> {
        Logger.info('Closing HTTP server...');

        return new Promise((resolve) => {
            this.httpServer.close(() => {
                Logger.info('HTTP server closed');
                resolve();
            });
        });
    }

    // for tests
    public getHttpServer(): http.Server {
        return this.httpServer;
    }

}
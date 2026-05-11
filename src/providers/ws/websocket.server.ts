import type { Server as HTTPServer } from 'node:http';
import { Server, Socket } from "socket.io";
import { Env } from '../../config/Env';
import { Logger } from '../logs/logger';

export class WSServer {
    private static instance: WSServer;
    protected io: Server;
    private user_socket: Map<string, Socket> = new Map<string, Socket>();

    private constructor(server: HTTPServer) {
        this.io = new Server(server, {
            transports: ["websocket"],
            path: "/api/v1/ws",
        });
    }

    public static getInstance(io: HTTPServer) {
        if (!this.instance) {
            this.instance = new WSServer(io);
        }
        return this.instance;
    }

    initialize() {
        Logger.socket("WebSocket Server is running");

        this.io.on('connection', (socket: Socket) => {
            this.connectUser(socket);
            socket.on('disconnect', () => this.disconnectUser(socket));
            socket.on("error", (data: Error) => this.errorUser(socket, data));
        });
    }

    private connectUser(socket: Socket) {
        this.user_socket.set(socket.id, socket);
        Logger.socket(`Users Connected: ${this.io.engine.clientsCount}`);
    }

    private disconnectUser(socket: Socket) {
        this.user_socket.delete(socket.id);
        Logger.socket(`Users Connected: ${this.io.engine.clientsCount}`);
    }

    private errorUser(socket: Socket, data: Error) {
        Logger.error(data);
        socket.emit("error", data);
    }

    public emitMessage<T extends Object>(event: string, data: T) {
        const ActualSocket = Array.from(this.user_socket.values()).filter((socket) => socket.connected);
        ActualSocket.map((socket) => socket.emit(event, data));
    }
}
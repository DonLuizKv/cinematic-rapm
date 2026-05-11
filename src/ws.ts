import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'node:http';

let io: Server;

export function initWebSocket(server: HTTPServer) {
    io = new Server(server, {
        cors: {
            origin: '*',
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 [WS] Nuevo cliente conectado: ${socket.id}`);
        
        socket.on('disconnect', () => {
            console.log(`🔌 [WS] Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
}

export function emitTelemetry(data: any) {
    if (io) {
        io.emit('message', data);
    }
}

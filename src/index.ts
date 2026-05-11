import express from 'express';
import path from 'path';
import http from 'http';
import { mqttBroker } from './mqttBroker';
import { initWebSocket } from './ws';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3000;

// Crear servidor HTTP para adjuntar Socket.io
const server = http.createServer(app);
initWebSocket(server);

app.use(express.json());
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Iniciar conexión MQTT
mqttBroker.connect();

// Usar rutas separadas para mantener el código limpio
app.use('/api', apiRoutes);

// Servir la página web (index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`🚀 Servidor Express y WebSocket corriendo en el puerto ${PORT}`);
});
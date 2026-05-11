import { Router } from 'express';
import { mqttBroker } from '../mqttBroker';

const router: Router = Router();

// Ruta para verificar estado del servidor
router.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend Node.js + MQTT en ejecución' });
});

// Ruta para enviar comandos al ESP32
router.post('/esp32/command', (req, res) => {
    const { command, value } = req.body;
    
    if (!command) {
        return res.status(400).json({ error: 'Se requiere enviar un "command"' });
    }

    const payload = JSON.stringify({ command, value: value ?? null });
    console.log('🚀 ~ router.post ~ payload:', payload);

    mqttBroker.publish('esp32/commands', payload);

    res.json({ success: true, message: 'Comando enviado al ESP32', payload: { command, value } });
});

export default router;

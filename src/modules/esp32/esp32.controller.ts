import type { Request, Response } from "express";
import type { Esp32Service } from "./esp32.service";

export class Esp32Controller {
    constructor(
        private service: Esp32Service
    ) { }

    Command = async (req: Request, res: Response) => {
        const { command, value } = req.body;

        if (!command) {
            return res.status(400).json({ error: 'Se requiere enviar un "command"' });
        }

        await this.service.sendCommand(command, value);

        res.json({ success: true, message: 'Comando enviado al ESP32', payload: { command, value } });
    }
}
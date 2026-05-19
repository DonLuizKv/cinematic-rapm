import Express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { Logger } from "../logs/logger";
import { Errors } from "../../errors/Errors";
import { errorsMiddleware } from "./middlewares/errors.middleware";
import type { MQTTBroker } from "../mqtt/broker";
import { Esp32Module } from "../../modules/esp32/esp32.module";

interface ExpressServerConfig {
    origins: string[];
    mqttBroker: MQTTBroker;
}

export class ExpressServer {
    private app: Express.Application;

    constructor(private config: ExpressServerConfig) {
        this.app = Express();
    }

    private setupMiddlewares() {
        const corsOptions = {
            origin: (
                origin: string | undefined,
                callback: (err: Error | null, allow?: boolean) => void
            ) => {
                if (!origin || this.config.origins.includes(origin)) {
                    return callback(null, true);
                }

                const message = `Origin ${origin} is not allowed by CORS`;
                Logger.warn(message);

                return callback(Errors.CLIENT.FORBIDDEN(message), false);
            },
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
        };

        this.app.use(Express.json());
        this.app.use(Express.urlencoded({ extended: true }));
        this.app.use(cors(corsOptions));
    }

    private setUpErrorMiddlewares() {
        this.app.use(errorsMiddleware);
    }

    private setupRoutes() {
        this.app.get("/api/v1/health", (req: Request, res: Response) => {
            res.json({ status: "ok" });
        });

        this.app.use("/api/v1/esp32", Esp32Module.create(this.config));

        const publicDir = path.resolve(process.cwd(), "public");
        if (!fs.existsSync(publicDir)) {
            Logger.warn(`Carpeta public no encontrada en ${publicDir}`);
        }

        this.app.use(Express.static(publicDir));

        // Express 5 no admite app.get("*"); fallback SPA para rutas no-API
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            if (req.method !== "GET" || req.path.startsWith("/api/")) {
                return next();
            }
            res.sendFile(path.join(publicDir, "index.html"), (err) => {
                if (err) next(err);
            });
        });
    }

    public getApp() {
        return this.app;
    }

    public async setup() {
        this.setupMiddlewares();
        this.setupRoutes();
        this.setUpErrorMiddlewares();
    }
}
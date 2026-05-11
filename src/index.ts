import { Ramp } from "./app";
import { Env } from "./config/Env"
import { Logger } from "./providers/logs/logger";

async function bootstrap() {
    const application = new Ramp({
        port: Env.Global.PORT,
        origins: Env.Global.ORIGINS,
        mqttHost: Env.Mqtt.HOST,
    });

    try {
        await application.load();
        application.start();
    } catch (error: unknown) {
        Logger.error(`Error starting ramp: ${error instanceof Error ? error.message : error}`);
        await application.stop();
        process.exit(1);
    }
}

bootstrap();
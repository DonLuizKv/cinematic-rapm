import { config } from "dotenv";
import { Errors } from "../errors/Errors";

config();

type EnvironmentKeys = {
    Global: {
        PORT: number,
        NODE_ENV: string,
        ORIGINS: string[]
    },
    Mqtt: {
        HOST: string,
    },
}

export const Env: EnvironmentKeys = {
    Global: {
        PORT: number("PORT"),
        NODE_ENV: required("NODE_ENV"),
        ORIGINS: list("ORIGINS", []),
    },
    Mqtt: {
        HOST: required("MQTT_HOST"),
    },
} as const;


function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw Errors.SERVER.INTERNAL_SERVER_ERROR(`Missing environment variable: ${name}`);
    }
    return value;
}

function number(name: string, defaultValue?: number): number {
    const value = process.env[name];
    if (!value) {
        if (defaultValue === undefined) {
            throw Errors.SERVER.INTERNAL_SERVER_ERROR(`Missing environment variable: ${name}`);
        }
        return defaultValue;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        throw Errors.SERVER.INTERNAL_SERVER_ERROR(`Environment variable ${name} must be a number`);
    }

    return parsed;
}

function list(name: string, defaultValue: string[] = []): string[] {
    const value = process.env[name];
    if (!value) return defaultValue;
    return value.split(",").map(v => v.trim());
}
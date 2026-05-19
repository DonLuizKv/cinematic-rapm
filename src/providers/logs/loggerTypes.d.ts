export type Color = "black" | "red" | "green" | "yellow" | "blue" | "violet" | "white" | "cyan";
export type LogLevel = "info" | "warn" | "error" | "http" | "socket" | "mqtt";
export type HttpMethods = "POST" | "PUT" | "DELETE" | "GET" | "PATCH" | "OPTIONS" | "HEAD";

export interface StyleConfig {
    color?: Color;
    bgColor?: Color;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
}

export type LogPart = "general" | "tag" | "msg";
export type LogConfig = Partial<Record<LogPart, StyleConfig>>;

export interface ExtraConfigLog {
    styles?: LogConfig;
    prefix?: string;
    suffix?: string;
    live?: LiveLogOptions;
}

export interface LiveLogOptions {
    key: string;
    lines?: number;
}

interface LiveSlot {
    lines: number;
}

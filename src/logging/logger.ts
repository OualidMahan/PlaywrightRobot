export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const priorities: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export class ConsoleLogger implements Logger {
  private readonly level: LogLevel;
  private readonly scope: string;

  constructor(level: LogLevel = "info", scope: string = "framework") {
    this.level = level;
    this.scope = scope;
  }

  debug(message: string): void { this.log("debug", message); }
  info(message: string): void { this.log("info", message); }
  warn(message: string): void { this.log("warn", message); }
  error(message: string): void { this.log("error", message); }

  private log(level: Exclude<LogLevel, "silent">, message: string): void {
    if (priorities[level] < priorities[this.level]) return;
    console[level](`${new Date().toISOString()} [${level.toUpperCase()}] [${this.scope}] ${message}`);
  }
}

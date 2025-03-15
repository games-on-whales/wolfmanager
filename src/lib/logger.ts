export const LogComponent = {
  WOLF_UI: "wolf-ui",
  WOLF_SERVER: "wolf-server",
  CONTAINER: "container",
  PAIRING: "pairing",
  AUTH: "auth",
  SYSTEM: "system",
  STEAM: "steam",
} as const;

type LogComponentType = (typeof LogComponent)[keyof typeof LogComponent];

interface LoggerInterface {
  debug(component: LogComponentType, message: string, metadata?: any): void;
  info(component: LogComponentType, message: string, metadata?: any): void;
  warn(component: LogComponentType, message: string, metadata?: any): void;
  error(component: LogComponentType, message: string, error?: any): void;
}

// Server-side logger
export const logger: LoggerInterface = {
  debug(component, message, metadata) {
    console.debug(`[${component}] ${message}`, metadata || "");
  },
  info(component, message, metadata) {
    console.info(`[${component}] ${message}`, metadata || "");
  },
  warn(component, message, metadata) {
    console.warn(`[${component}] ${message}`, metadata || "");
  },
  error(component, message, error) {
    console.error(`[${component}] ${message}`, error || "");
  },
};

// Client-side logger
export const clientLogger: LoggerInterface = {
  debug(component, message, metadata) {
    console.debug(`[${component}] ${message}`, metadata || "");
  },
  info(component, message, metadata) {
    console.info(`[${component}] ${message}`, metadata || "");
  },
  warn(component, message, metadata) {
    console.warn(`[${component}] ${message}`, metadata || "");
  },
  error(component, message, error) {
    console.error(`[${component}] ${message}`, error || "");
  },
};

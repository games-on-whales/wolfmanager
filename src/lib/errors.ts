export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
    // Ensure the prototype chain is set correctly
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

// You can add other custom error types here as needed

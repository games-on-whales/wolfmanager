import { Agent } from "http";
import { Socket } from "net";

const WOLF_SOCKET_PATH = "/var/run/wolf/wolf.sock";

// Create a custom HTTP agent that uses Unix domain socket
function createWolfSocketAgent() {
  const agent = new Agent({
    keepAlive: false, // Disable keep-alive to ensure fresh connections
  });

  (agent as any).createConnection = (
    _: any,
    cb: (err: Error | null, socket: Socket) => void
  ) => {
    const connection = new Socket();
    connection.connect(WOLF_SOCKET_PATH);

    connection.once("error", (err) => {
      console.error("[WOLF_SOCKET_ERROR]", err);
      connection.destroy();
      cb(err, connection);
    });

    connection.once("connect", () => {
      cb(null, connection);
    });

    return connection;
  };

  return agent;
}

interface WolfApiOptions {
  method?: string;
  body?: any;
}

export async function callWolfApi(
  endpoint: string,
  options: WolfApiOptions = {}
) {
  const agent = createWolfSocketAgent();
  const { method = "GET", body } = options;

  try {
    const response = await fetch(`http://localhost/api/v1${endpoint}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      agent,
    });

    const responseText = await response.text();

    try {
      // Try to parse as JSON first
      return JSON.parse(responseText, (key, value) => {
        // Convert client_id to string to handle BigInt IDs
        if (key === "client_id" || key === "id") {
          return String(value);
        }
        return value;
      });
    } catch {
      // If not JSON, return text
      return responseText;
    }
  } catch (error) {
    console.error(`[WOLF_API_ERROR] ${endpoint}:`, error);
    throw error;
  }
}

// This file's logic has been split into api-test-console-server.tsx (server wrapper) and api-test-console-client.tsx (client component).
// The API Test Console now uses server actions instead of direct API calls for improved security.

// Re-export the server wrapper for compatibility:
export { default as ApiTestConsole } from "./api-test-console-server";
export { default } from "./api-test-console-server";

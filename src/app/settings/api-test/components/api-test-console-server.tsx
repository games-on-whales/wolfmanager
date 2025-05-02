import { getAvailableEndpoints } from "@/app/api/wolf/lib/schema";
import { getAvailableSteamEndpoints } from "@/app/api/libraries/steam/lib/schema";
import { getAvailableSystemEndpoints } from "@/app/api/system/lib/schema";
import ApiTestConsoleClient from "./api-test-console-client";

interface ApiTestConsoleServerProps {
  apiKey: string;
}

export default async function ApiTestConsoleServer({ apiKey }: ApiTestConsoleServerProps) {
  // Fetch all endpoints in parallel
  const [wolfEndpoints, steamEndpoints, systemEndpoints] = await Promise.all([
    getAvailableEndpoints(),
    getAvailableSteamEndpoints(),
    getAvailableSystemEndpoints(),
  ]);
  // Merge all endpoints
  const allEndpoints = [...wolfEndpoints, ...steamEndpoints, ...systemEndpoints];
  // Grouping logic
  function stripNonSerializable(endpoint: any) {
    // Remove known non-serializable fields
    const { requestSchema, responseSchema, components, ...rest } = endpoint;
    return { ...rest };
  }
  const endpoints = allEndpoints.map(endpoint => {
    let group = "Other API";
    let path = endpoint.path;
    if (path.includes("/wolf")) {
      group = "Wolf API";
      if (!path.startsWith("/api/wolf")) path = `/api${path}`;
    } else if (path.includes("/libraries/steam") || path.includes("/steam")) {
      group = "Steam API";
      if (!path.startsWith("/api/libraries/steam") && !path.startsWith("/api/steam")) path = `/api${path}`;
    } else if (path.includes("/system")) {
      group = "System API";
      if (!path.startsWith("/api/system")) path = `/api${path}`;
    } else if (path.startsWith("/api/")) {
      group = "Other API";
    } else {
      group = "Other API";
      path = `/api${path}`;
    }
    return stripNonSerializable({
      ...endpoint,
      path,
      group,
    });
  });
  return <ApiTestConsoleClient apiKey={apiKey} endpoints={endpoints} />;
}

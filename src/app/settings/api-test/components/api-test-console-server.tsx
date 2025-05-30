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
  // Process each endpoint array separately to ensure proper grouping
  function stripNonSerializable(endpoint: any) {
    // Remove known non-serializable fields
    const { requestSchema, responseSchema, components, ...rest } = endpoint;
    return { ...rest };
  }

  // Process Wolf endpoints
  const processedWolfEndpoints = wolfEndpoints.map(endpoint => {
    let path = endpoint.path;
    // All wolf endpoints should go through /api/wolf/ proxy
    if (!path.startsWith("/api/wolf")) {
      path = `/api/wolf${path}`;
    }
    return stripNonSerializable({
      ...endpoint,
      path,
      group: "Wolf API",
    });
  });

  // Process Steam endpoints (they already have /api/ prefix)
  const processedSteamEndpoints = steamEndpoints.map(endpoint => {
    return stripNonSerializable({
      ...endpoint,
      group: "Steam API",
    });
  });

  // Process System endpoints (they already have /api/ prefix)
  const processedSystemEndpoints = systemEndpoints.map(endpoint => {
    return stripNonSerializable({
      ...endpoint,
      group: "System API",
    });
  });

  // Merge all processed endpoints
  const endpoints = [...processedWolfEndpoints, ...processedSteamEndpoints, ...processedSystemEndpoints];
  return <ApiTestConsoleClient apiKey={apiKey} endpoints={endpoints} />;
}

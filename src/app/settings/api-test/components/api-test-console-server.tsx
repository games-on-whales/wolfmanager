import { getAvailableSteamEndpoints } from "@/app/api/libraries/steam/lib/schema";
import { getAvailableSystemEndpoints } from "@/app/api/system/lib/schema";
import { getWolfApiEndpointsAction } from "@/app/actions/api-test-actions";
import ApiTestConsoleClient from "./api-test-console-client";

// Process each endpoint array separately to ensure proper grouping
function stripNonSerializable(endpoint: any) {
  // Remove known non-serializable fields that can't be sent to client
  const { requestSchema, responseSchema, components, ...rest } = endpoint;
  return { ...rest };
}

export default async function ApiTestConsoleServer() {
  try {
    // Fetch Wolf endpoints through server action and others through existing functions
    const [wolfResult, steamEndpoints, systemEndpoints] = await Promise.all([
      getWolfApiEndpointsAction(),
      getAvailableSteamEndpoints(),
      getAvailableSystemEndpoints(),
    ]);

    // Process Wolf endpoints from server action
    let processedWolfEndpoints: any[] = [];
    if (wolfResult.success && wolfResult.data?.endpoints) {
      processedWolfEndpoints = wolfResult.data.endpoints.map(endpoint => {
        let path = endpoint.path;
        // Ensure wolf endpoints have the /api/wolf/ prefix for the UI
        if (!path.startsWith("/api/wolf")) {
          path = `/api/wolf${path}`;
        }
        return stripNonSerializable({
          ...endpoint,
          path,
          group: "Wolf API",
        });
      });
    }

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
    
    return <ApiTestConsoleClient endpoints={endpoints} />;
  } catch (error) {
    console.error("Failed to load API endpoints:", error);
    
    // Return client with empty endpoints if there's an error
    return <ApiTestConsoleClient endpoints={[]} />;
  }
}

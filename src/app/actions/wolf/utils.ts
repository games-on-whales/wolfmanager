import { LogComponent, logger } from "@/lib/logger";

/**
 * Helper function to deduplicate Wolf client list by client_id
 * Takes the most recent entry for each client_id (last one in the array)
 */
export function deduplicateWolfClients(clients: any[]): any[] {
  const clientMap = new Map<string, any>();
  const pairSecretMap = new Map<string, any>();
  const duplicateStats = {
    byId: 0,
    byPairSecret: 0,
    total: clients.length
  };
  
  for (const client of clients) {
    const clientId = client.client_id || client.id;
    const pairSecret = client.pair_secret;
    
    if (clientId) {
      // Check for ID duplicates
      if (clientMap.has(clientId)) {
        duplicateStats.byId++;
        logger.debug(LogComponent.WOLF_UI, "Duplicate client ID detected in Wolf API response", {
          clientId,
          existingClient: clientMap.get(clientId),
          duplicateClient: client
        });
      }
      
      // Check for pair secret duplicates
      if (pairSecret && pairSecretMap.has(pairSecret)) {
        duplicateStats.byPairSecret++;
        logger.debug(LogComponent.WOLF_UI, "Duplicate pair secret detected in Wolf API response", {
          pairSecret,
          clientId,
          existingClientId: pairSecretMap.get(pairSecret).client_id || pairSecretMap.get(pairSecret).id
        });
      }
      
      // Always take the latest entry (overwrites previous)
      clientMap.set(clientId, client);
      if (pairSecret) {
        pairSecretMap.set(pairSecret, client);
      }
    } else {
      logger.warn(LogComponent.WOLF_UI, "Client without ID detected in Wolf API response", { client });
    }
  }
  
  const deduplicatedClients = Array.from(clientMap.values());
  
  if (duplicateStats.byId > 0 || duplicateStats.byPairSecret > 0) {
    logger.info(LogComponent.WOLF_UI, "Wolf API client deduplication completed", {
      originalCount: duplicateStats.total,
      deduplicatedCount: deduplicatedClients.length,
      duplicatesById: duplicateStats.byId,
      duplicatesByPairSecret: duplicateStats.byPairSecret,
      totalDuplicatesRemoved: duplicateStats.total - deduplicatedClients.length
    });
  }
  
  return deduplicatedClients;
}
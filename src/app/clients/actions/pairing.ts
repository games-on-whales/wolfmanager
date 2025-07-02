"use server";
import { getServerSession } from "next-auth/next";
import { LogComponent, logger } from "@/lib/logger";
import { authOptions } from "@/lib/auth";
import { SocketService } from "@/lib/services/socket-service";
import { addClientDevice, getClientDevicesByUserId } from "@/lib/db/helpers/clients";
import { getWolfClientAction } from "@/app/actions/wolf-actions";

// Maximum retry attempts for client confirmation after pairing
const MAX_CONFIRM_RETRIES = 3;
const CONFIRM_RETRY_DELAY = 500; // milliseconds

// Maximum retry attempts for unpairing duplicate clients
const MAX_UNPAIR_RETRIES = 3;
const UNPAIR_RETRY_DELAY = 500; // milliseconds
const UNPAIR_VERIFY_DELAY = 1000; // milliseconds, increased to allow Wolf API to update state before verification
const UNPAIR_VERIFY_RETRIES = 2; // verification retry attempts

// Helper function to get raw Wolf clients without deduplication (needed for duplicate detection)
async function getRawWolfClients(session: any, socketService: any): Promise<any[]> {
  const response = await socketService.callWolfApi(session, "/clients", {
    method: "GET",
  });
  
  if (!response.success) {
    logger.warn(
      LogComponent.WOLF_UI,
      "[Helper] Failed to get raw Wolf clients",
      { userId: session.user.id, error: response.error }
    );
    return [];
  }

  const data = response.data as any;
  if (data && typeof data === "object" && data.success === true && Array.isArray(data.clients)) {
    return data.clients; // Return raw, non-deduplicated clients
  }
  
  return [];
}

// Action to pair and add a client - based on stable branch implementation
export async function pairAndAddClientAction(pairingData: { pair_secret: string; pin: string; friendlyName?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for pair and add client action"
      );
      return { success: false, error: "No valid session" };
    }

    const { pair_secret, pin, friendlyName } = pairingData;

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Starting Wolf client pairing process",
      { userId: session.user.id, pairSecret: pair_secret }
    );

    // Step 1: Get existing user clients to identify what's already paired
    const existingUserClients = await getClientDevicesByUserId(session.user.id);
    const existingWolfClientIds = new Set(
      existingUserClients.map(uc => uc.wolfClientId).filter(Boolean)
    );

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Pre-pairing state captured",
      { 
        userId: session.user.id, 
        existingClientCount: existingUserClients.length,
        existingWolfClientIds: Array.from(existingWolfClientIds)
      }
    );

    // Step 2: Perform the actual pairing with Wolf
    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(
      session,
      "/pair/client",
      {
        method: "POST",
        body: { pair_secret, pin },
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.success) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to pair with Wolf API",
        new Error(response.error || "Unknown error"),
        { userId: session.user.id }
      );
      return { success: false, error: response.error || "Unknown error" };
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully paired with Wolf API",
      { userId: session.user.id }
    );

    // Step 3: Detect the new client by comparing Wolf client lists with retry logic
    let newDeviceId: string | null = null;
    let confirmAttempt = 0;

    while (confirmAttempt < MAX_CONFIRM_RETRIES && !newDeviceId) {
      confirmAttempt++;
      
      // Small delay to allow Wolf to process the pairing
      if (confirmAttempt > 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIRM_RETRY_DELAY));
      }

      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Attempting to confirm new client",
        { userId: session.user.id, attempt: confirmAttempt }
      );

      // Get raw Wolf clients without deduplication to detect duplicates
      const postWolfClients = await getRawWolfClients(session, socketService);
      
      if (postWolfClients.length === 0) {
        logger.warn(
          LogComponent.WOLF_UI,
          "[Action] No Wolf clients returned after pairing for confirmation",
          { userId: session.user.id, attempt: confirmAttempt }
        );
        continue;
      }

      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Got raw Wolf clients for duplicate detection",
        { 
          userId: session.user.id, 
          attempt: confirmAttempt,
          rawClientCount: postWolfClients.length,
          clientIds: postWolfClients.map(c => c.client_id || c.id).filter(Boolean)
        }
      );
      
      // Detect duplicates in Wolf clients AFTER pairing
      const duplicateClientIds = new Set<string>();
      const clientIdMap = new Map<string, any>();
      const pairSecretMap = new Map<string, any>();

      // Enhanced duplicate detection
      for (const client of postWolfClients) {
        const clientId = (client as any).client_id || (client as any).id;
        const clientPairSecret = (client as any).pair_secret;
        
        if (clientId) {
          if (clientIdMap.has(clientId)) {
            duplicateClientIds.add(clientId);
          }
          clientIdMap.set(clientId, client);
        }
        
        if (clientPairSecret) {
          if (pairSecretMap.has(clientPairSecret)) {
            const existingClient = pairSecretMap.get(clientPairSecret);
            const existingClientId = existingClient.client_id || existingClient.id;
            if (existingClientId) duplicateClientIds.add(existingClientId);
            if (clientId) duplicateClientIds.add(clientId);
          }
          pairSecretMap.set(clientPairSecret, client);
        }
      }

      // If duplicates found after pairing, clean them up
      if (duplicateClientIds.size > 0) {
        logger.warn(
          LogComponent.WOLF_UI,
          "[Action] Duplicate clients detected after pairing, starting cleanup",
          { 
            userId: session.user.id,
            duplicateClientIds: Array.from(duplicateClientIds),
            attempt: confirmAttempt,
            totalClientsBeforeCleanup: postWolfClients.length
          }
        );

        let unpairRequestsSent = 0;
        let unpairFailures = 0;
        const uniqueClientIds = Array.from(duplicateClientIds); // Only unpair each unique client_id once

        for (const clientId of uniqueClientIds) {
          let unpairAttempt = 0;
          let unpairSuccess = false;

          logger.info(
            LogComponent.WOLF_UI,
            "[Action] Starting unpair process for duplicate client",
            { 
              userId: session.user.id, 
              clientId, 
              totalDuplicates: uniqueClientIds.length,
              duplicateInstances: postWolfClients.filter(c => 
                ((c as any).client_id || (c as any).id) === clientId
              ).length
            }
          );

          while (unpairAttempt < MAX_UNPAIR_RETRIES && !unpairSuccess) {
            unpairAttempt++;
            if (unpairAttempt > 1) {
              await new Promise(resolve => setTimeout(resolve, UNPAIR_RETRY_DELAY));
            }

            logger.info(
              LogComponent.WOLF_UI,
              "[Action] Attempting to unpair duplicate client",
              { userId: session.user.id, clientId, attempt: unpairAttempt, maxAttempts: MAX_UNPAIR_RETRIES }
            );

            try {
              const unpairResponse = await socketService.callWolfApi(session, "/unpair/client", {
                method: "POST",
                body: { client_id: clientId },
                headers: { "Content-Type": "application/json" }
              });

              if (unpairResponse.success) {
                logger.info(
                  LogComponent.WOLF_UI,
                  "[Action] Unpair API call succeeded, verifying removal",
                  { userId: session.user.id, clientId, attempt: unpairAttempt }
                );

                // Improved verification with retries
                let verificationSuccess = false;
                for (let verifyAttempt = 1; verifyAttempt <= UNPAIR_VERIFY_RETRIES; verifyAttempt++) {
                  // Add delay to allow Wolf API to update its state
                  await new Promise(resolve => setTimeout(resolve, UNPAIR_VERIFY_DELAY));

                  // Verify the client was actually unpaired by checking if it still exists
                  const verifyClients = await getRawWolfClients(session, socketService);
                  const stillExists = verifyClients.some(c =>
                    ((c as any).client_id || (c as any).id) === clientId
                  );
                  
                  logger.debug(
                    LogComponent.WOLF_UI,
                    "[Action] Unpair verification attempt",
                    { 
                      userId: session.user.id, 
                      clientId, 
                      verifyAttempt, 
                      stillExists,
                      totalClientsAfterUnpair: verifyClients.length,
                      remainingClientIds: verifyClients.map(c => (c as any).client_id || (c as any).id)
                    }
                  );
                  
                  if (!stillExists) {
                    verificationSuccess = true;
                    break;
                  }
                }

                if (verificationSuccess) {
                  unpairSuccess = true;
                  unpairRequestsSent++;
                  logger.info(
                    LogComponent.WOLF_UI,
                    "[Action] Successfully unpaired and verified duplicate client removal",
                    { userId: session.user.id, clientId, attempt: unpairAttempt }
                  );
                } else {
                  logger.warn(
                    LogComponent.WOLF_UI,
                    "[Action] Unpair API succeeded but client still exists after verification retries",
                    { userId: session.user.id, clientId, attempt: unpairAttempt, verificationRetries: UNPAIR_VERIFY_RETRIES }
                  );
                }
              } else {
                logger.warn(
                  LogComponent.WOLF_UI,
                  "[Action] Unpair API request failed, retrying...",
                  {
                    userId: session.user.id,
                    clientId,
                    attempt: unpairAttempt,
                    error: unpairResponse.error,
                    statusCode: unpairResponse.statusCode,
                    responseData: unpairResponse.data
                  }
                );
              }
            } catch (unpairError) {
              logger.error(
                LogComponent.WOLF_UI,
                "[Action] Exception during unpair request, retrying...",
                unpairError instanceof Error ? unpairError : new Error(String(unpairError)),
                { 
                  userId: session.user.id, 
                  clientId, 
                  attempt: unpairAttempt,
                  errorMessage: unpairError instanceof Error ? unpairError.message : String(unpairError),
                  errorStack: unpairError instanceof Error ? unpairError.stack : undefined
                }
              );
            }
          } // End of unpair retry loop

          if (!unpairSuccess) {
            unpairFailures++;
            logger.error(
              LogComponent.WOLF_UI,
              "[Action] Failed to unpair duplicate client after all attempts",
              { 
                userId: session.user.id, 
                clientId, 
                maxAttempts: MAX_UNPAIR_RETRIES,
                totalFailures: unpairFailures,
                remainingDuplicates: uniqueClientIds.length - unpairRequestsSent
              }
            );
          }
        } // End of forEach unique duplicate client

        // Fixed logic: ALWAYS return error when duplicates are detected to ensure user retries pairing
        if (unpairRequestsSent > 0) {
          logger.info(
            LogComponent.WOLF_UI,
            "[Action] Duplicate cleanup completed with successes",
            { 
              userId: session.user.id, 
              unpairRequestsSent, 
              unpairFailures,
              totalDuplicatesFound: uniqueClientIds.length
            }
          );
          return { 
            success: false, 
            error: `Duplicate clients detected and ${unpairRequestsSent} removed successfully. Please try the pairing process again.` 
          };
        } else if (unpairFailures > 0) {
          logger.error(
            LogComponent.WOLF_UI,
            "[Action] Duplicate cleanup failed for all clients",
            { 
              userId: session.user.id, 
              unpairFailures,
              totalDuplicatesFound: uniqueClientIds.length
            }
          );
          return {
            success: false,
            error: `Duplicate clients detected but cleanup failed. Please check Wolf API connectivity and try again.`
          };
        } else {
          // Edge case: duplicates detected but cleanup had no successes or failures
          // This should not happen, but ensure we always return error when duplicates are found
          logger.error(
            LogComponent.WOLF_UI,
            "[Action] Duplicate clients detected but cleanup process had unexpected results",
            { 
              userId: session.user.id, 
              totalDuplicatesFound: uniqueClientIds.length,
              unpairRequestsSent,
              unpairFailures
            }
          );
          return {
            success: false,
            error: `Duplicate clients detected and cleanup was attempted. Please try the pairing process again.`
          };
        }
      }

      const currentWolfClientIds = postWolfClients.map(c => (c as any).client_id || (c as any).id).filter(Boolean);
      
      // Find new clients by comparing with existing user associations
      const newClientIds: string[] = [];
      for (const wolfClientId of currentWolfClientIds) {
        if (!existingWolfClientIds.has(wolfClientId)) {
          newClientIds.push(wolfClientId);
        }
      }

      if (newClientIds.length === 1) {
        newDeviceId = newClientIds[0];
        logger.info(
          LogComponent.WOLF_UI,
          "[Action] Successfully detected new client",
          { userId: session.user.id, newDeviceId, attempt: confirmAttempt }
        );
        break;
      } else if (newClientIds.length > 1) {
        logger.warn(
          LogComponent.WOLF_UI,
          "[Action] Multiple new clients detected, this may indicate an issue",
          { userId: session.user.id, newClientIds, attempt: confirmAttempt }
        );
        // Take the first one for now
        newDeviceId = newClientIds[0];
        break;
      }
    }

    if (!newDeviceId) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Unable to detect new client after pairing",
        new Error("Client confirmation failed"),
        { userId: session.user.id }
      );
      return { success: false, error: "Unable to confirm new client after pairing" };
    }

    // Step 4: Get full client information from Wolf
    const wolfClientResponse = await getWolfClientAction(newDeviceId);
    if (!wolfClientResponse.success || !wolfClientResponse.data?.client) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Unable to retrieve client information from Wolf after pairing",
        new Error("Client retrieval failed"),
        { userId: session.user.id, newDeviceId }
      );
      return { success: false, error: "Unable to retrieve client information from Wolf after pairing" };
    }

    const wolfClient = wolfClientResponse.data.client;

    // Step 5: Add client to database
    try {
      const clientDeviceData = {
        userId: session.user.id,
        wolfClientId: newDeviceId,
        pairSecret: pair_secret,
        friendlyName: friendlyName || newDeviceId,
        deviceType: wolfClient.status || 'Unknown',
        status: 'paired',
        lastSeen: new Date().toISOString(),
      };

      const savedClient = await addClientDevice(clientDeviceData);

      logger.info(
        LogComponent.WOLF_UI,
        "[Action] Successfully completed pairing and database insertion",
        { userId: session.user.id, clientId: savedClient.id, wolfClientId: newDeviceId }
      );

      return { 
        success: true, 
        data: { 
          client: savedClient,
          wolfClient: wolfClient
        } 
      };

    } catch (dbError) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to add client to database after successful Wolf pairing",
        dbError instanceof Error ? dbError : new Error(String(dbError)),
        { userId: session.user.id, wolfClientId: newDeviceId }
      );
      
      return { 
        success: false, 
        error: `Pairing succeeded but failed to save client: ${dbError instanceof Error ? dbError.message : "Unknown error"}` 
      };
    }

  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error in pairing process",
      error instanceof Error ? error : new Error(String(error))
    );
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Internal function to attempt pairing with Wolf
export async function attemptPairingWithWolf(pairingCode: string): Promise<any> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      logger.warn(
        LogComponent.WOLF_UI,
        "[Action] No session for attempt pairing with Wolf"
      );
      return null;
    }

    logger.debug(
      LogComponent.WOLF_UI,
      "[Action] Attempting pairing with Wolf",
      { userId: session.user.id, pairingCode }
    );

    const socketService = SocketService.getInstance();
    const response = await socketService.callWolfApi(
      session,
      "/pair/attempt",
      {
        method: "POST",
        body: { pairingCode },
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.success) {
      logger.error(
        LogComponent.WOLF_UI,
        "[Action] Failed to attempt pairing with Wolf",
        new Error(response.error || "Unknown error"),
        { userId: session.user.id }
      );
      return null;
    }

    logger.info(
      LogComponent.WOLF_UI,
      "[Action] Successfully attempted pairing with Wolf",
      { userId: session.user.id, pairingResult: response.data }
    );

    return response.data;
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "[Action] Error attempting pairing with Wolf",
      error instanceof Error ? error : new Error(String(error))
    );
    return null;
  }
}
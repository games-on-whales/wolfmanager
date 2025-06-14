"use server";

import { authOptions } from "@/lib/auth";
import { addUserAsync } from "@/lib/config";
import { deleteUser as deleteUserFromDb, getAllUsers, updateUser as updateUserInDb } from "@/lib/db/helpers/users";
import bcrypt from "bcryptjs";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  debugInfo?: {
    operationId: string;
    operation: string;
    targetState?: boolean;
    errorType?: string;
    timestamp: string;
  };
}

export async function createUser(data: {
  username: string;
  password: string;
  isAdmin: boolean;
}): Promise<ActionResponse<User>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    logger.debug(LogComponent.WOLF_UI, "Creating new user", {
      username: data.username,
      isAdmin: data.isAdmin,
    });

    const newUser = await addUserAsync(data.username, data.password, data.isAdmin);
    const user: User = {
      id: newUser.id,
      username: newUser.username,
      isAdmin: newUser.is_admin,
      createdAt: newUser.created_at,
      updatedAt: newUser.updated_at,
    };

    logger.info(LogComponent.WOLF_UI, "User created successfully", {
      userId: user.id,
    });

    revalidatePath("/users");
    return { success: true, data: user };
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "Failed to create user",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

export async function updateUserAction(
  userId: string,
  data: {
    username?: string;
    password?: string;
    isAdmin?: boolean;
  }
): Promise<ActionResponse<User>> {
  const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const isAdminToggle = data.isAdmin !== undefined && Object.keys(data).length === 1;
  
  try {
    // Enhanced logging for operation start
    logger.info(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Starting user update operation", {
      operationId,
      userId,
      isAdminToggle,
      targetAdminState: data.isAdmin,
      updateFields: Object.keys(data),
      timestamp: new Date().toISOString()
    });

    // Run comprehensive diagnostics for admin toggle operations
    if (isAdminToggle) {
      const { runAdminToggleDiagnostics, logDiagnosticResults } = await import("@/lib/debug/admin-toggle-diagnostics");
      const diagnostics = await runAdminToggleDiagnostics(userId, data.isAdmin!);
      
      logDiagnosticResults(diagnostics);
      
      // If diagnostics found errors, fail early with detailed information
      if (diagnostics.errors.length > 0) {
        const errorMessage = `Admin toggle pre-flight check failed: ${diagnostics.errors.join("; ")}`;
        logger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Pre-flight check failed", new Error(errorMessage), {
          operationId,
          diagnosticOperationId: diagnostics.operationId,
          errors: diagnostics.errors,
          warnings: diagnostics.warnings,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: false,
          error: errorMessage,
          debugInfo: {
            operationId,
            operation: "admin_toggle_diagnostics",
            targetState: data.isAdmin,
            errorType: "PreFlightCheckFailed",
            timestamp: new Date().toISOString()
          }
        };
      }
      
      // Log warnings but continue
      if (diagnostics.warnings.length > 0) {
        logger.warn(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Pre-flight check warnings", {
          operationId,
          diagnosticOperationId: diagnostics.operationId,
          warnings: diagnostics.warnings,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Session validation with detailed logging
    const session = await getServerSession(authOptions);
    logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Session validation", {
      operationId,
      userId,
      hasSession: !!session,
      hasUser: !!session?.user,
      userRole: session?.user?.role,
      sessionUserId: session?.user?.id,
      isAuthorized: !!(session?.user && session.user.role === "admin"),
      timestamp: new Date().toISOString()
    });

    if (!session?.user || session.user.role !== "admin") {
      logger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Unauthorized access attempt", {
        operationId,
        userId,
        hasSession: !!session,
        hasUser: !!session?.user,
        userRole: session?.user?.role,
        sessionUserId: session?.user?.id,
        timestamp: new Date().toISOString()
      });
      throw new Error("Unauthorized - Admin privileges required");
    }

    // Validate target user exists before update
    logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Validating target user exists", {
      operationId,
      userId,
      timestamp: new Date().toISOString()
    });

    const { getUserById } = await import("@/lib/db/helpers/users");
    const existingUser = await getUserById(userId);
    
    logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Target user validation result", {
      operationId,
      userId,
      userExists: !!existingUser,
      currentAdminState: existingUser?.isAdmin,
      targetAdminState: data.isAdmin,
      userDetails: existingUser ? {
        id: existingUser.id,
        username: existingUser.username,
        isAdmin: existingUser.isAdmin,
        createdAt: existingUser.createdAt,
        updatedAt: existingUser.updatedAt
      } : null,
      timestamp: new Date().toISOString()
    });

    if (!existingUser) {
      logger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Target user not found", {
        operationId,
        userId,
        timestamp: new Date().toISOString()
      });
      throw new Error(`User with ID ${userId} not found`);
    }

    // Additional validation for admin toggle
    if (isAdminToggle) {
      logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Admin toggle validation", {
        operationId,
        userId,
        currentAdminState: existingUser.isAdmin,
        targetAdminState: data.isAdmin,
        isTogglingToFalse: data.isAdmin === false,
        timestamp: new Date().toISOString()
      });

      // Check if this is the last admin being demoted
      if (data.isAdmin === false && existingUser.isAdmin) {
        const allUsers = await import("@/lib/db/helpers/users").then(m => m.getAllUsers());
        const adminCount = allUsers.filter(u => u.isAdmin).length;
        
        logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Last admin check", {
          operationId,
          userId,
          totalAdmins: adminCount,
          wouldBeLastAdmin: adminCount === 1,
          timestamp: new Date().toISOString()
        });

        if (adminCount === 1) {
          logger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Cannot remove last admin", {
            operationId,
            userId,
            adminCount,
            timestamp: new Date().toISOString()
          });
          throw new Error("Cannot remove admin privileges from the last administrator");
        }
      }
    }

    // Prepare update data with detailed logging
    const updateData: any = {};
    
    if (data.username !== undefined) {
      updateData.username = data.username;
      logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Including username update", {
        operationId,
        userId,
        newUsername: data.username,
        timestamp: new Date().toISOString()
      });
    }
    
    if (data.password !== undefined) {
      const salt = bcrypt.genSaltSync(10);
      updateData.passwordHash = bcrypt.hashSync(data.password, salt);
      logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Including password update", {
        operationId,
        userId,
        passwordLength: data.password.length,
        timestamp: new Date().toISOString()
      });
    }
    
    if (data.isAdmin !== undefined) {
      updateData.isAdmin = data.isAdmin;
      logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Including admin state update", {
        operationId,
        userId,
        currentAdminState: existingUser.isAdmin,
        newAdminState: data.isAdmin,
        timestamp: new Date().toISOString()
      });
    }

    logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Prepared update data", {
      operationId,
      userId,
      updateFields: Object.keys(updateData),
      updateData: { ...updateData, passwordHash: updateData.passwordHash ? '[REDACTED]' : undefined },
      timestamp: new Date().toISOString()
    });

    // Execute database update with enhanced error handling
    logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Executing database update", {
      operationId,
      userId,
      timestamp: new Date().toISOString()
    });

    let updatedUser;
    try {
      updatedUser = await updateUserInDb(userId, updateData);
      logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Database update completed", {
        operationId,
        userId,
        success: true,
        updatedUserData: {
          id: updatedUser.id,
          username: updatedUser.username,
          isAdmin: updatedUser.isAdmin,
          updatedAt: updatedUser.updatedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      logger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Database update failed", dbError as Error, {
        operationId,
        userId,
        updateData: { ...updateData, passwordHash: updateData.passwordHash ? '[REDACTED]' : undefined },
        errorMessage: dbError instanceof Error ? dbError.message : String(dbError),
        errorStack: dbError instanceof Error ? dbError.stack : undefined,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Database update failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    // Validate the update was successful
    logger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Validating update success", {
      operationId,
      userId,
      timestamp: new Date().toISOString()
    });

    if (!updatedUser) {
      logger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Update returned null/undefined", {
        operationId,
        userId,
        updatedUser,
        timestamp: new Date().toISOString()
      });
      throw new Error("Database update returned null - update may have failed");
    }

    // For admin toggle, validate the change actually took effect
    if (isAdminToggle && updatedUser.isAdmin !== data.isAdmin) {
      logger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Admin toggle validation failed", {
        operationId,
        userId,
        expectedAdminState: data.isAdmin,
        actualAdminState: updatedUser.isAdmin,
        timestamp: new Date().toISOString()
      });
      throw new Error(`Admin toggle failed - expected isAdmin=${data.isAdmin}, got isAdmin=${updatedUser.isAdmin}`);
    }
    
    const user: User = {
      id: updatedUser.id,
      username: updatedUser.username,
      isAdmin: updatedUser.isAdmin,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    logger.info(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: User update operation completed successfully", {
      operationId,
      userId,
      isAdminToggle,
      finalUserState: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        updatedAt: user.updatedAt
      },
      timestamp: new Date().toISOString()
    });

    revalidatePath("/users");
    return { success: true, data: user };
  } catch (error) {
    const errorDetails = {
      operationId,
      userId,
      isAdminToggle,
      targetAdminState: data.isAdmin,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      timestamp: new Date().toISOString()
    };

    logger.error(
      LogComponent.WOLF_UI,
      "ADMIN_TOGGLE_DEBUG: User update operation failed",
      error instanceof Error ? error : new Error(String(error)),
      errorDetails
    );

    // Return detailed error information for debugging
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
      debugInfo: isAdminToggle ? {
        operationId,
        operation: "admin_toggle",
        targetState: data.isAdmin,
        errorType: errorDetails.errorType,
        timestamp: errorDetails.timestamp
      } : undefined
    };
  }
}

export async function deleteUser(
  userId: string
): Promise<ActionResponse<void>> {
  logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser action called", {
    userId,
    timestamp: new Date().toISOString()
  });

  try {
    // 1. Ensure database is initialized first
    logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser ensuring database initialization", {
      userId,
      timestamp: new Date().toISOString()
    });

    const { initializeDatabaseWithMigration } = await import("@/lib/db/initializer");
    try {
      await initializeDatabaseWithMigration();
      logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser database initialization completed", {
        userId,
        timestamp: new Date().toISOString()
      });
    } catch (initError) {
      logger.error(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser database initialization failed", initError as Error, {
        userId,
        timestamp: new Date().toISOString()
      });
      // Continue anyway, the database might already be initialized
    }

    const session = await getServerSession(authOptions);
    logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser session check", {
      userId,
      hasSession: !!session,
      hasUser: !!session?.user,
      userRole: session?.user?.role,
      isAdmin: session?.user?.role === "admin",
      timestamp: new Date().toISOString()
    });

    if (!session?.user || session.user.role !== "admin") {
      logger.error(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser unauthorized", {
        userId,
        hasSession: !!session,
        hasUser: !!session?.user,
        userRole: session?.user?.role,
        timestamp: new Date().toISOString()
      });
      throw new Error("Unauthorized");
    }

    logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser calling database helper", {
      userId,
      functionName: "deleteUserFromDb",
      timestamp: new Date().toISOString()
    });

    // Check if user exists first
    const { getUserById } = await import("@/lib/db/helpers/users");
    const existingUser = await getUserById(userId);
    
    logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser user existence check", {
      userId,
      userExists: !!existingUser,
      userDetails: existingUser ? {
        id: existingUser.id,
        username: existingUser.username,
        isAdmin: existingUser.isAdmin
      } : null,
      timestamp: new Date().toISOString()
    });

    if (!existingUser) {
      logger.error(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser - user not found", {
        userId,
        timestamp: new Date().toISOString()
      });
      throw new Error("User not found");
    }

    // Check for related client devices
    const { getClientDevicesByUserId } = await import("@/lib/db/helpers/clients");
    const userClients = await getClientDevicesByUserId(userId);
    
    logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser client devices check", {
      userId,
      clientCount: userClients.length,
      clientIds: userClients.map(c => c.id),
      timestamp: new Date().toISOString()
    });

    // Delete user's client devices first to avoid foreign key constraints
    if (userClients.length > 0) {
      logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser removing client devices first", {
        userId,
        clientCount: userClients.length,
        timestamp: new Date().toISOString()
      });

      const { deleteClientDevice } = await import("@/lib/db/helpers/clients");
      for (const client of userClients) {
        await deleteClientDevice(client.id);
        logger.debug(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser removed client device", {
          userId,
          clientId: client.id,
          timestamp: new Date().toISOString()
        });
      }
    }

    await deleteUserFromDb(userId);

    logger.info(LogComponent.WOLF_UI, "DIAGNOSIS: deleteUser completed successfully", {
      userId,
      timestamp: new Date().toISOString()
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "DIAGNOSIS: deleteUser failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        userId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}

export async function getUsers(): Promise<ActionResponse<User[]>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const dbUsers = await getAllUsers();
    const users = dbUsers.map((user) => ({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    logger.info(LogComponent.WOLF_UI, "User list fetched", {
      count: users.length,
    });

    return { success: true, data: users };
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "Failed to fetch users",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch users",
    };
  }
}

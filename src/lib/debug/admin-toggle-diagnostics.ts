import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface AdminToggleDiagnostics {
  operationId: string;
  timestamp: string;
  sessionValid: boolean;
  userExists: boolean;
  adminCount: number;
  databaseConnected: boolean;
  permissionValid: boolean;
  currentState: {
    userId: string;
    username?: string;
    isAdmin?: boolean;
    lastUpdated?: string;
  };
  targetState: {
    isAdmin: boolean;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive diagnostic check for admin toggle operations
 */
export async function runAdminToggleDiagnostics(
  userId: string,
  targetAdminState: boolean
): Promise<AdminToggleDiagnostics> {
  const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  const diagnostics: AdminToggleDiagnostics = {
    operationId,
    timestamp,
    sessionValid: false,
    userExists: false,
    adminCount: 0,
    databaseConnected: false,
    permissionValid: false,
    currentState: {
      userId
    },
    targetState: {
      isAdmin: targetAdminState
    },
    errors: [],
    warnings: []
  };

  try {
    logger.info(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Starting comprehensive diagnostic check", {
      operationId,
      userId,
      targetAdminState,
      timestamp
    });

    // 1. Check session validation
    try {
      const session = await getServerSession(authOptions);
      diagnostics.sessionValid = !!(session?.user && session.user.role === "admin");
      diagnostics.permissionValid = diagnostics.sessionValid;
      
      if (!diagnostics.sessionValid) {
        diagnostics.errors.push("Session validation failed - no valid admin session found");
      }
      
      logger.debug(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Session check", {
        operationId,
        sessionValid: diagnostics.sessionValid,
        hasSession: !!session,
        hasUser: !!session?.user,
        userRole: session?.user?.role,
        sessionUserId: session?.user?.id
      });
    } catch (sessionError) {
      diagnostics.errors.push(`Session check failed: ${sessionError instanceof Error ? sessionError.message : String(sessionError)}`);
      logger.error(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Session check error", sessionError as Error, { operationId });
    }

    // 2. Check database connection
    try {
      const { getDatabase } = await import("@/lib/db/index");
      const db = await getDatabase();
      diagnostics.databaseConnected = !!db;
      
      if (!diagnostics.databaseConnected) {
        diagnostics.errors.push("Database connection failed");
      }
      
      logger.debug(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Database check", {
        operationId,
        databaseConnected: diagnostics.databaseConnected
      });
    } catch (dbError) {
      diagnostics.errors.push(`Database connection failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      logger.error(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Database check error", dbError as Error, { operationId });
    }

    // 3. Check if target user exists and get current state
    try {
      const { getUserById, getAllUsers } = await import("@/lib/db/helpers/users");
      const targetUser = await getUserById(userId);
      
      diagnostics.userExists = !!targetUser;
      
      if (targetUser) {
        diagnostics.currentState = {
          userId: targetUser.id,
          username: targetUser.username,
          isAdmin: targetUser.isAdmin,
          lastUpdated: targetUser.updatedAt
        };
        
        // Check admin count
        const allUsers = await getAllUsers();
        diagnostics.adminCount = allUsers.filter(u => u.isAdmin).length;
        
        // Check for last admin scenario
        if (targetAdminState === false && targetUser.isAdmin && diagnostics.adminCount === 1) {
          diagnostics.errors.push("Cannot remove admin privileges from the last administrator");
        }
        
        // Check if change is actually needed
        if (targetUser.isAdmin === targetAdminState) {
          diagnostics.warnings.push(`User is already ${targetAdminState ? 'an admin' : 'not an admin'} - no change needed`);
        }
        
      } else {
        diagnostics.errors.push(`Target user with ID ${userId} not found`);
      }
      
      logger.debug(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: User existence check", {
        operationId,
        userExists: diagnostics.userExists,
        adminCount: diagnostics.adminCount,
        currentState: diagnostics.currentState
      });
    } catch (userError) {
      diagnostics.errors.push(`User lookup failed: ${userError instanceof Error ? userError.message : String(userError)}`);
      logger.error(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: User check error", userError as Error, { operationId });
    }

    // 4. Check for potential data type issues
    if (typeof targetAdminState !== 'boolean') {
      diagnostics.errors.push(`Invalid target admin state type: expected boolean, got ${typeof targetAdminState}`);
    }

    // 5. Additional validations
    if (diagnostics.currentState.isAdmin !== undefined && diagnostics.targetState.isAdmin !== undefined) {
      if (diagnostics.currentState.isAdmin === diagnostics.targetState.isAdmin) {
        diagnostics.warnings.push("No state change required - current and target states are identical");
      }
    }

    // Summary
    const hasErrors = diagnostics.errors.length > 0;
    const hasWarnings = diagnostics.warnings.length > 0;
    
    logger.info(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Diagnostic check completed", {
      operationId,
      summary: {
        sessionValid: diagnostics.sessionValid,
        userExists: diagnostics.userExists,
        databaseConnected: diagnostics.databaseConnected,
        adminCount: diagnostics.adminCount,
        errorCount: diagnostics.errors.length,
        warningCount: diagnostics.warnings.length,
        canProceed: !hasErrors
      },
      errors: diagnostics.errors,
      warnings: diagnostics.warnings
    });

    return diagnostics;
  } catch (overallError) {
    const errorMessage = overallError instanceof Error ? overallError.message : String(overallError);
    diagnostics.errors.push(`Diagnostic check failed: ${errorMessage}`);
    
    logger.error(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Overall diagnostic failure", overallError as Error, {
      operationId,
      diagnostics
    });
    
    return diagnostics;
  }
}

/**
 * Log the diagnostic results in a human-readable format
 */
export function logDiagnosticResults(diagnostics: AdminToggleDiagnostics): void {
  const { operationId } = diagnostics;
  
  logger.info(LogComponent.SYSTEM, "ADMIN_TOGGLE_DIAGNOSTICS: Diagnostic Summary", {
    operationId,
    timestamp: diagnostics.timestamp,
    checks: {
      "Session Valid": diagnostics.sessionValid ? "✅ PASS" : "❌ FAIL",
      "User Exists": diagnostics.userExists ? "✅ PASS" : "❌ FAIL", 
      "Database Connected": diagnostics.databaseConnected ? "✅ PASS" : "❌ FAIL",
      "Permissions Valid": diagnostics.permissionValid ? "✅ PASS" : "❌ FAIL"
    },
    context: {
      "Current Admin State": diagnostics.currentState.isAdmin,
      "Target Admin State": diagnostics.targetState.isAdmin,
      "Total Admin Count": diagnostics.adminCount,
      "Username": diagnostics.currentState.username
    },
    issues: {
      "Error Count": diagnostics.errors.length,
      "Warning Count": diagnostics.warnings.length,
      "Errors": diagnostics.errors,
      "Warnings": diagnostics.warnings
    },
    recommendation: diagnostics.errors.length === 0 
      ? "✅ PROCEED - All checks passed"
      : "❌ DO NOT PROCEED - Errors detected"
  });
}
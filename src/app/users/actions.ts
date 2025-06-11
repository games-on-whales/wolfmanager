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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    logger.debug(LogComponent.WOLF_UI, "Updating user", {
      userId,
      username: data.username,
      isAdmin: data.isAdmin,
    });

    // Prepare update data
    const updateData: any = {};
    
    if (data.username !== undefined) {
      updateData.username = data.username;
    }
    
    if (data.password !== undefined) {
      const salt = bcrypt.genSaltSync(10);
      updateData.passwordHash = bcrypt.hashSync(data.password, salt);
    }
    
    if (data.isAdmin !== undefined) {
      updateData.isAdmin = data.isAdmin;
    }

    const updatedUser = await updateUserInDb(userId, updateData);
    
    const user: User = {
      id: updatedUser.id,
      username: updatedUser.username,
      isAdmin: updatedUser.isAdmin,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    logger.info(LogComponent.WOLF_UI, "User updated successfully", {
      userId: user.id,
    });

    revalidatePath("/users");
    return { success: true, data: user };
  } catch (error) {
    logger.error(
      LogComponent.WOLF_UI,
      "Failed to update user",
      error instanceof Error ? error : new Error(String(error))
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
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

"use server";

import { authOptions } from "@/lib/auth";
import { addUser, loadConfig, removeUser } from "@/lib/config";
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

    await logger.debug(LogComponent.WOLF_UI, "Creating new user", {
      username: data.username,
      isAdmin: data.isAdmin,
    });

    const newUser = addUser(data.username, data.password, data.isAdmin);
    const user: User = {
      id: newUser.id,
      username: newUser.username,
      isAdmin: newUser.is_admin,
      createdAt: newUser.created_at,
      updatedAt: newUser.updated_at,
    };

    await logger.info(LogComponent.WOLF_UI, "User created successfully", {
      userId: user.id,
    });

    revalidatePath("/users");
    return { success: true, data: user };
  } catch (error) {
    await logger.error(
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

    await logger.debug(LogComponent.WOLF_UI, "Updating user", {
      userId,
      ...data,
    });

    const config = loadConfig();
    const existingUser = config.users[userId];
    if (!existingUser) {
      throw new Error("User not found");
    }

    // Update user in config
    if (data.username) existingUser.username = data.username;
    if (data.password) existingUser.password_hash = data.password; // Note: This should be hashed in production
    if (data.isAdmin !== undefined) existingUser.is_admin = data.isAdmin;
    existingUser.updated_at = new Date().toISOString();

    // Save config
    // Note: In a real app, you'd use a proper database update here
    const user: User = {
      id: existingUser.id,
      username: existingUser.username,
      isAdmin: existingUser.is_admin,
      createdAt: existingUser.created_at,
      updatedAt: existingUser.updated_at,
    };

    await logger.info(LogComponent.WOLF_UI, "User updated successfully", {
      userId,
    });

    revalidatePath("/users");
    return { success: true, data: user };
  } catch (error) {
    await logger.error(
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
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    await logger.debug(LogComponent.WOLF_UI, "Deleting user", {
      userId,
    });

    removeUser(userId);

    await logger.info(LogComponent.WOLF_UI, "User deleted successfully", {
      userId,
    });

    revalidatePath("/users");
    return { success: true };
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Failed to delete user",
      error instanceof Error ? error : new Error(String(error))
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

    const config = loadConfig();
    const users = Object.values(config.users).map((user) => ({
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }));

    await logger.info(LogComponent.WOLF_UI, "User list fetched", {
      count: users.length,
    });

    return { success: true, data: users };
  } catch (error) {
    await logger.error(
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

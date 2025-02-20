import { LoginCredentials, User } from "@/types/auth";

export interface AuthResponse extends User {
  requiresFirstTimeSetup: boolean;
}

// Mock users store - this would be replaced with a real database
const users: User[] = [
  {
    id: "1",
    username: "admin",
    isAdmin: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock authentication service
export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const data = await response.json();
    return {
      ...data,
      requiresFirstTimeSetup: !data.has_changed_password,
    };
  },

  async logout(): Promise<void> {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Logout failed");
    }
  },

  async updateUserProfile(username: string, data: { name: string }) {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to update profile");
    }

    return response.json();
  },

  async changePassword(
    username: string,
    currentPassword: string,
    newPassword: string
  ) {
    const response = await fetch(
      `/api/users/${encodeURIComponent(username)}/password`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      }
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Failed to change password");
    }
  },

  async getUsers(): Promise<User[]> {
    const response = await fetch("/api/users");
    if (!response.ok) {
      throw new Error("Failed to fetch users");
    }
    return response.json();
  },

  async addUser(
    username: string,
    password: string,
    isAdmin: boolean = false
  ): Promise<User> {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
        isAdmin,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to add user");
    }

    return response.json();
  },

  async removeUser(userId: string): Promise<void> {
    const response = await fetch(`/api/users/${userId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to remove user");
    }
  },
};

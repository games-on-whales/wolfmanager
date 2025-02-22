"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clientLogger, LogComponent } from "@/lib/logger";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isAdmin: z.boolean().default(false),
});

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UsersManagementProps {
  initialUsers: User[];
}

interface CreateUserFormData {
  username: string;
  password: string;
  isAdmin: boolean;
}

interface UpdateUserFormData {
  username?: string;
  password?: string;
  isAdmin?: boolean;
}

export function UsersManagement({ initialUsers }: UsersManagementProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      isAdmin: false,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Creating new user", {
        username: values.username,
        isAdmin: values.isAdmin,
      });

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const newUser = await response.json();
      setUsers((prev) => [...prev, newUser]);

      clientLogger.info(LogComponent.WOLF_UI, "User created successfully", {
        userId: newUser.id,
        username: newUser.username,
        isAdmin: newUser.isAdmin,
      });

      toast.success("User added successfully");
      setIsOpen(false);
      form.reset();
    } catch (error) {
      clientLogger.error(LogComponent.WOLF_UI, "Failed to create user", error, {
        formData: values,
      });

      toast.error(
        error instanceof Error ? error.message : "Failed to add user"
      );
    }
  };

  const handleRemoveUser = async (userId: string, username: string) => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Attempting to remove user", {
        userId,
        username,
      });

      const response = await fetch(`/api/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      setUsers((prev) => prev.filter((user) => user.id !== userId));

      clientLogger.info(LogComponent.WOLF_UI, "User removed successfully", {
        userId,
        username,
      });

      toast.success("User removed successfully");
    } catch (error) {
      clientLogger.error(LogComponent.WOLF_UI, "Failed to remove user", error, {
        userId,
        username,
      });

      toast.error(
        error instanceof Error ? error.message : "Failed to remove user"
      );
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Deleting user", { userId });
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      // Remove user from the list
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      toast.success("User deleted successfully");
      clientLogger.info(LogComponent.WOLF_UI, "User deleted successfully", {
        userId,
      });
    } catch (error) {
      clientLogger.error(LogComponent.WOLF_UI, "Failed to delete user", error);
      toast.error("Failed to delete user");
    }
  };

  const handleCreateUser = async (data: CreateUserFormData) => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Creating new user", {
        username: data.username,
      });
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to create user");
      }

      const newUser = await response.json();
      setUsers((prev) => [...prev, newUser]);
      toast.success("User created successfully");
      clientLogger.info(LogComponent.WOLF_UI, "User created successfully", {
        userId: newUser.id,
      });
    } catch (error) {
      clientLogger.error(LogComponent.WOLF_UI, "Failed to create user", error);
      toast.error("Failed to create user");
    }
  };

  const handleUpdateUser = async (userId: string, data: UpdateUserFormData) => {
    try {
      clientLogger.info(LogComponent.WOLF_UI, "Updating user", { userId });
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      const updatedUser = await response.json();
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? updatedUser : user))
      );
      toast.success("User updated successfully");
      clientLogger.info(LogComponent.WOLF_UI, "User updated successfully", {
        userId,
      });
    } catch (error) {
      clientLogger.error(LogComponent.WOLF_UI, "Failed to update user", error);
      toast.error("Failed to update user");
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">User Management</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account. The user will be prompted to change
                their password on first login.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        User will be required to change this on first login
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isAdmin"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Administrator
                        </FormLabel>
                        <FormDescription>
                          Grant administrative privileges to this user
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Create User</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{user.username}</CardTitle>
                  <CardDescription>
                    {user.isAdmin ? "Administrator" : "Standard User"}
                  </CardDescription>
                </div>
                {user.username !== "admin" && (
                  <Button
                    variant="destructive"
                    onClick={() => handleRemoveUser(user.id, user.username)}
                  >
                    Remove User
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Created
                    </Label>
                    <p className="text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Last Updated
                    </Label>
                    <p className="text-sm">
                      {new Date(user.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

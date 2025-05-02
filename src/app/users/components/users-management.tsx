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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOptimistic, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { createUser, deleteUser, updateUserAction } from "../actions";

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

export function UsersManagement({ initialUsers }: UsersManagementProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [optimisticUsers, addOptimisticUser] = useOptimistic(initialUsers);

  const addOptimisticUserToList = (newUser: User) => {
    addOptimisticUser((state: User[]) => [...state, newUser]);
  };

  const removeOptimisticUser = (userId: string) => {
    addOptimisticUser((state: User[]) =>
      state.filter((user) => user.id !== userId)
    );
  };

  const updateOptimisticUser = (userId: string, updatedUser: Partial<User>) => {
    addOptimisticUser((state: User[]) =>
      state.map((user) =>
        user.id === userId ? { ...user, ...updatedUser } : user
      )
    );
  };

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
      await clientLogger.debug(LogComponent.WOLF_UI, "Creating new user", {
        username: values.username,
        isAdmin: values.isAdmin,
      });

      startTransition(async () => {
        const result = await createUser(values);

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to create user");
        }

        const newUser: User = result.data;
        addOptimisticUserToList(newUser);

        await clientLogger.info(
          LogComponent.WOLF_UI,
          "User created successfully",
          {
            userId: newUser.id,
          }
        );

        showToast.success("Success", {
          description: "User created successfully",
        });
        setIsOpen(false);
        form.reset();
      });
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to create user");
      await clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to create user",
        err
      );
      showToast.error("Error", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await clientLogger.debug(LogComponent.WOLF_UI, "Deleting user", {
        userId,
      });

      startTransition(async () => {
        const result = await deleteUser(userId);

        if (!result.success) {
          throw new Error(result.error || "Failed to delete user");
        }

        removeOptimisticUser(userId);

        await clientLogger.info(
          LogComponent.WOLF_UI,
          "User deleted successfully",
          {
            userId,
          }
        );

        showToast.success("Success", {
          description: "User deleted successfully",
        });
      });
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to delete user");
      await clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to delete user",
        err
      );
      showToast.error("Error", err);
    }
  };

  const handleUpdateUser = async (
    userId: string,
    data: {
      username?: string;
      password?: string;
      isAdmin?: boolean;
    }
  ) => {
    try {
      await clientLogger.debug(LogComponent.WOLF_UI, "Updating user", {
        userId,
        ...data,
      });

      startTransition(async () => {
        const result = await updateUserAction(userId, data);

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to update user");
        }

        const updatedUser: User = result.data;
        updateOptimisticUser(userId, updatedUser);

        await clientLogger.info(
          LogComponent.WOLF_UI,
          "User updated successfully",
          {
            userId,
          }
        );

        showToast.success("Success", {
          description: "User updated successfully",
        });
      });
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error("Failed to update user");
      await clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to update user",
        err
      );
      showToast.error("Error", err);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <Card className="glass-card border-none p-6">
        <CardHeader>
          <CardTitle>Users Management</CardTitle>
          <CardDescription>Manage system users and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button>Add User</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with specified permissions.
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
                            <Input {...field} />
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
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
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
                            <FormLabel>Administrator</FormLabel>
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
                      <Button type="submit" disabled={isPending}>
                        {isPending ? "Creating..." : "Create User"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <div className="space-y-4">
              {optimisticUsers.map((user) => (
                <Card key={user.id} className="border-none glass-card">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.isAdmin ? "Administrator" : "User"}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleUpdateUser(user.id, {
                            isAdmin: !user.isAdmin,
                          })
                        }
                        disabled={isPending}
                      >
                        Toggle Admin
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

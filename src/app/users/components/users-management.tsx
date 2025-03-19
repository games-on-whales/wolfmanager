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
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

      const result = await createUser(values);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to create user");
      }

      const newUser: User = result.data;
      setUsers((prev) => [...prev, newUser]);

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

      const result = await deleteUser(userId);

      if (!result.success) {
        throw new Error(result.error || "Failed to delete user");
      }

      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));

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

      const result = await updateUserAction(userId, data);

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to update user");
      }

      const updatedUser: User = result.data;
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, ...updatedUser } : user
        )
      );

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
                    onClick={() => handleDeleteUser(user.id)}
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

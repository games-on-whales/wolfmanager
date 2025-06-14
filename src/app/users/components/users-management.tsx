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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition, useMemo } from "react";
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
  const [searchFilter, setSearchFilter] = useState("");

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

  // Filter users based on search input
  const filteredUsers = useMemo(() => {
    if (!searchFilter.trim()) {
      return optimisticUsers;
    }
    return optimisticUsers.filter(user =>
      user.username.toLowerCase().includes(searchFilter.toLowerCase())
    );
  }, [optimisticUsers, searchFilter]);

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
    const isAdminToggle = data.isAdmin !== undefined && Object.keys(data).length === 1;
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      await clientLogger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: UI starting user update", {
        operationId,
        userId,
        isAdminToggle,
        targetAdminState: data.isAdmin,
        updateFields: Object.keys(data),
        timestamp: new Date().toISOString(),
        ...data,
      });

      // Find current user state for comparison
      const currentUser = optimisticUsers.find(u => u.id === userId);
      await clientLogger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Current user state", {
        operationId,
        userId,
        currentUserFound: !!currentUser,
        currentAdminState: currentUser?.isAdmin,
        targetAdminState: data.isAdmin,
        timestamp: new Date().toISOString()
      });

      startTransition(async () => {
        try {
          await clientLogger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Calling updateUserAction", {
            operationId,
            userId,
            timestamp: new Date().toISOString()
          });

          const result = await updateUserAction(userId, data);

          await clientLogger.debug(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: updateUserAction response", {
            operationId,
            userId,
            success: result.success,
            hasData: !!result.data,
            error: result.error,
            debugInfo: result.debugInfo,
            timestamp: new Date().toISOString()
          });

          if (!result.success || !result.data) {
            // Enhanced error handling with debug info
            let errorMessage = result.error || "Failed to update user";
            
            if (result.debugInfo && isAdminToggle) {
              errorMessage = `Admin toggle failed: ${result.error}`;
              
              await clientLogger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Admin toggle operation failed", new Error(errorMessage), {
                operationId,
                userId,
                serverOperationId: result.debugInfo.operationId,
                targetAdminState: result.debugInfo.targetState,
                errorType: result.debugInfo.errorType,
                serverTimestamp: result.debugInfo.timestamp,
                timestamp: new Date().toISOString()
              });
            }

            throw new Error(errorMessage);
          }

          const updatedUser: User = result.data;
          
          // Validate the update for admin toggles
          if (isAdminToggle && updatedUser.isAdmin !== data.isAdmin) {
            const validationError = `Admin toggle validation failed - expected isAdmin=${data.isAdmin}, got isAdmin=${updatedUser.isAdmin}`;
            
            await clientLogger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: UI validation failed", new Error(validationError), {
              operationId,
              userId,
              expectedAdminState: data.isAdmin,
              actualAdminState: updatedUser.isAdmin,
              updatedUserData: updatedUser,
              timestamp: new Date().toISOString()
            });

            throw new Error(validationError);
          }

          updateOptimisticUser(userId, updatedUser);

          await clientLogger.info(
            LogComponent.WOLF_UI,
            "ADMIN_TOGGLE_DEBUG: User updated successfully in UI",
            {
              operationId,
              userId,
              isAdminToggle,
              finalState: {
                username: updatedUser.username,
                isAdmin: updatedUser.isAdmin,
                updatedAt: updatedUser.updatedAt
              },
              timestamp: new Date().toISOString()
            }
          );

          const successMessage = isAdminToggle
            ? `Admin privileges ${updatedUser.isAdmin ? 'granted to' : 'removed from'} ${updatedUser.username}`
            : "User updated successfully";

          showToast.success("Success", {
            description: successMessage,
          });
        } catch (transitionError) {
          // Log transition-specific errors
          await clientLogger.error(LogComponent.WOLF_UI, "ADMIN_TOGGLE_DEBUG: Error in transition", transitionError as Error, {
            operationId,
            userId,
            isAdminToggle,
            timestamp: new Date().toISOString()
          });
          throw transitionError;
        }
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to update user");
      
      await clientLogger.error(
        LogComponent.WOLF_UI,
        "ADMIN_TOGGLE_DEBUG: UI handleUpdateUser failed",
        err,
        {
          operationId,
          userId,
          isAdminToggle,
          targetAdminState: data.isAdmin,
          errorMessage: err.message,
          timestamp: new Date().toISOString()
        }
      );

      // Provide specific error messages for admin toggle failures
      const errorMessage = isAdminToggle
        ? `Failed to ${data.isAdmin ? 'grant' : 'remove'} admin privileges: ${err.message}`
        : err.message;

      showToast.error("Error", new Error(errorMessage));
    }
  };

  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardDescription className="text-gray-400">
              Manage user accounts and permissions
            </CardDescription>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Add User</Button>
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
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Input
          placeholder="Search users..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="mb-4"
        />
        <Table className="border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.1)]">
              <TableHead className="text-[#fffb96] py-3 px-4">
                Username
              </TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4 text-right">
                Admin
              </TableHead>
              <TableHead className="text-[#fffb96] text-right py-3 px-4">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow
                key={user.id}
                className="border-b border-neutral-700 hover:bg-neutral-800"
              >
                <TableCell className="text-white py-3 px-4">
                  <p className="font-medium">{user.username}</p>
                </TableCell>
                <TableCell className="text-white py-3 px-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <Switch
                      id={`admin-toggle-${user.id}`}
                      checked={user.isAdmin}
                      onCheckedChange={(checked) =>
                        handleUpdateUser(user.id, {
                          isAdmin: checked,
                        })
                      }
                      disabled={isPending}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right py-3 px-4">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={isPending}
                    title="Delete User"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete User</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {filteredUsers.length === 0 && optimisticUsers.length > 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-gray-400 py-3 px-4"
                >
                  No users match your search
                </TableCell>
              </TableRow>
            )}

            {optimisticUsers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-gray-400 py-3 px-4"
                >
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

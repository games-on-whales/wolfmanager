"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import type { ClientSettings } from "@/types/wolf";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { updateClientSettingsAndNameAction } from "../update-client-actions";

// Define a type for the client data including the optional owner and additional properties
type ClientWithOwner = {
  id: string;
  friendly_name: string;
  owner?: string;
  device_type?: string;
  last_seen?: string;
  status?: string;
  wolf_client_id?: string;
  settings?: ClientSettings;
  app_state_folder?: string;
};

interface EditClientSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientWithOwner;
  onSuccess?: () => void;
}

// Form validation schema
const formSchema = z.object({
  friendly_name: z.string().min(1, "Client name is required").max(255, "Client name too long"),
  app_state_folder: z.string().optional(),
  controllers_override: z.array(
    z.enum(["auto", "xbox", "nintendo", "ps"])
  ).default(["auto"]).transform((val) => val.length === 0 ? ["auto"] : val),
  mouse_acceleration: z.coerce
    .number()
    .min(0, "Mouse acceleration must be 0 or greater"),
  h_scroll_acceleration: z.coerce
    .number()
    .min(0, "Horizontal scroll acceleration must be 0 or greater"),
  v_scroll_acceleration: z.coerce
    .number()
    .min(0, "Vertical scroll acceleration must be 0 or greater"),
});

type FormValues = z.infer<typeof formSchema>;

const CONTROLLER_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "xbox", label: "Xbox" },
  { value: "nintendo", label: "Nintendo" },
  { value: "ps", label: "PlayStation" },
] as const;

const EditClientSettingsDialog: React.FC<EditClientSettingsDialogProps> = ({
  isOpen,
  onClose,
  client,
  onSuccess,
}) => {
  const [isPending, startTransition] = useTransition();
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      friendly_name: "",
      app_state_folder: "",
      controllers_override: ["auto"],
      mouse_acceleration: 1.0,
      h_scroll_acceleration: 1.0,
      v_scroll_acceleration: 1.0,
    },
  });

  // Load current client settings when dialog opens
  useEffect(() => {
    if (isOpen && client) {
      loadClientSettings();
    }
  }, [isOpen, client]);

  const loadClientSettings = async () => {
    try {
      setIsLoadingSettings(true);
      
      // Use client settings if available, otherwise use defaults
      const defaultSettings = {
        friendly_name: client.friendly_name || "",
        app_state_folder: client.app_state_folder || "",
        controllers_override: ["auto"] as Array<'auto' | 'xbox' | 'nintendo' | 'ps'>,
        mouse_acceleration: 1.0,
        h_scroll_acceleration: 1.0,
        v_scroll_acceleration: 1.0,
      };

      let settingsToLoad = defaultSettings;
      
      if (client.settings) {
        // Convert Wolf API settings format to form format
        // Wolf API uses uppercase controller types, form uses lowercase
        const normalizedControllers = client.settings.controllers_override?.map(
          controller => controller.toLowerCase() as 'auto' | 'xbox' | 'nintendo' | 'ps'
        ) || ["auto"];
        
        settingsToLoad = {
          friendly_name: client.friendly_name || "",
          app_state_folder: client.app_state_folder || "",
          controllers_override: normalizedControllers,
          mouse_acceleration: client.settings.mouse_acceleration || 1.0,
          h_scroll_acceleration: client.settings.h_scroll_acceleration || 1.0,
          v_scroll_acceleration: client.settings.v_scroll_acceleration || 1.0,
        };
      }
      
      form.reset(settingsToLoad);

      await clientLogger.debug(
        LogComponent.WOLF_UI,
        "Loaded client settings for editing",
        {
          clientId: client.id,
          friendlyName: client.friendly_name,
          hasExistingSettings: !!client.settings,
          rawSettings: client.settings,
          normalizedSettings: settingsToLoad
        }
      );
    } catch (error) {
      await clientLogger.error(
        LogComponent.WOLF_UI,
        "Failed to load client settings",
        error instanceof Error ? error : new Error(String(error)),
        { clientId: client.id }
      );
      
      showToast.error("Error", "Failed to load client settings");
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    startTransition(async () => {
      try {
        await clientLogger.info(
          LogComponent.WOLF_UI,
          "Attempting to update client settings, name, and app state folder",
          {
            clientId: client.wolf_client_id || client.id,
            databaseId: client.id,
            oldFriendlyName: client.friendly_name,
            newFriendlyName: data.friendly_name,
            newAppStateFolder: data.app_state_folder,
            settings: data
          }
        );

        const settings: ClientSettings = {
          controllers_override: data.controllers_override?.length > 0
            ? data.controllers_override as Array<'auto' | 'xbox' | 'nintendo' | 'ps'>
            : ["auto"],
          mouse_acceleration: data.mouse_acceleration,
          h_scroll_acceleration: data.h_scroll_acceleration,
          v_scroll_acceleration: data.v_scroll_acceleration,
        };

        const result = await updateClientSettingsAndNameAction(
          client.wolf_client_id || client.id,
          data.friendly_name,
          settings,
          data.app_state_folder
        );

        if (!result.success) {
          const errorMessage = result.error?.message || "Failed to update client settings and name";
          throw new Error(errorMessage);
        }

        await clientLogger.info(
          LogComponent.WOLF_UI,
          "Successfully updated client settings and name",
          {
            clientId: client.wolf_client_id || client.id,
            databaseId: client.id,
            oldFriendlyName: client.friendly_name,
            newFriendlyName: data.friendly_name,
            settings
          }
        );

        showToast.success("Success", {
          description: `Settings and name updated for ${data.friendly_name}`,
        });

        onClose();
        onSuccess?.();
      } catch (error) {
        await clientLogger.error(
          LogComponent.WOLF_UI,
          "Failed to update client settings and name",
          error instanceof Error ? error : new Error(String(error)),
          {
            clientId: client.wolf_client_id || client.id,
            databaseId: client.id,
            friendlyName: client.friendly_name,
            newFriendlyName: data.friendly_name
          }
        );

        showToast.error("Error", error instanceof Error ? error.message : "Failed to update client settings and name");
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass-card">
        <DialogHeader>
          <DialogTitle>Edit Client Settings</DialogTitle>
          <DialogDescription>
            Configure name and settings for this client
          </DialogDescription>
        </DialogHeader>

        {isLoadingSettings ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading settings...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="friendly_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter client name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="app_state_folder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App State Folder</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Default (Unique per client)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      Set a shared folder name to share game data across devices. Leave empty for default behavior.
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="controllers_override"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Controllers Override</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value?.[0] || "auto"}
                        onValueChange={(value) => {
                          field.onChange([value as "auto" | "xbox" | "nintendo" | "ps"]);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select controller type" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700">
                          {CONTROLLER_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="text-white hover:bg-gray-800 focus:bg-gray-800"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="mouse_acceleration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mouse Acceleration</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="1.0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="h_scroll_acceleration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horizontal Scroll Acceleration</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="1.0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="v_scroll_acceleration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vertical Scroll Acceleration</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="1.0"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || isLoadingSettings}>
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditClientSettingsDialog;
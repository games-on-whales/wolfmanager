"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { showToast } from "@/lib/toast";
import { useSession } from "next-auth/react";
import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom"; // Import useFormState
import { SettingsFormState, updateSteamGridDbSettings } from "../actions"; // Import Server Action

interface SteamGridDbSettingsData {
  enabled: boolean;
  isApiKeySet: boolean;
}

export function SteamGridDbSettings() {
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [settings, setSettings] = useState<SteamGridDbSettingsData | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition(); // For form submission state
  const [apiKeyStatus, setApiKeyStatus] = useState<
    "Set" | "Not Set" | "Checking..."
  >("Checking...");

  useEffect(() => {
    // Fetch initial settings
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        // Use the settings API endpoint path
        const response = await fetch("/api/metadata/steamgriddb/settings");
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch settings: ${response.status} ${
              errorText || response.statusText
            }`
          );
        }
        const data: SteamGridDbSettingsData = await response.json();

        setSettings(data);
        setIsEnabled(data.enabled);
        setApiKeyStatus(data.isApiKeySet ? "Set" : "Not Set");
      } catch (error) {
        console.error("Error fetching SteamGridDB settings:", error);
        showToast.error("Error", "Could not load SteamGridDB settings.");
        setApiKeyStatus("Not Set"); // Default on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // --- Server Action Form Handling ---
  const initialState: SettingsFormState = { success: false, message: "" };
  // Initialize useFormState with the server action and initial state
  const [state, formAction] = useFormState(
    updateSteamGridDbSettings,
    initialState
  );

  // Effect to handle form submission results (toast, state updates)
  useEffect(() => {
    // Check if there's a message from the server action result
    if (state.message) {
      if (state.success) {
        // Show success toast
        showToast.success("Success", { description: state.message });
        // Clear API key input on successful save
        setApiKey("");
        // Update local state based on the response from the server action
        if (state.updatedStatus) {
          setIsEnabled(state.updatedStatus.enabled);
          setApiKeyStatus(state.updatedStatus.isApiKeySet ? "Set" : "Not Set");
          // Update the settings state as well
          setSettings((prev) => ({
            ...prev!, // Assume settings were loaded if we got here
            enabled: state.updatedStatus!.enabled,
            isApiKeySet: state.updatedStatus!.isApiKeySet,
          }));
        }
      } else {
        // Show error toast, combining form and field errors
        let errorDescription = state.message;
        if (state.errors?._form) {
          errorDescription += ` ${state.errors._form.join(" ")}`;
        }
        if (state.errors?.apiKey) {
          errorDescription += ` API Key: ${state.errors.apiKey.join(" ")}`;
        }
        if (state.errors?.enabled) {
          errorDescription += ` Enabled: ${state.errors.enabled.join(" ")}`;
        }
        showToast.error("Error Saving Settings", errorDescription);
      }
    }
    // Dependency array includes 'state' to react to form submission results
  }, [state]);
  // --- End Server Action Form Handling ---

  // Handle loading states for session and data
  if (sessionStatus === "loading" || isLoading) {
    // TODO: Use a proper loading component/spinner from the UI library if available
    return <div>Loading SteamGridDB Settings...</div>;
  }

  // Explicit admin check before rendering the form content
  if (sessionStatus === "authenticated" && !isAdmin) {
    // This component might not need the admin check anymore if the parent page enforces it,
    // but keeping it adds defense in depth.
    console.warn("Non-admin user attempted to access SteamGridDB settings UI.");
    return (
      <p className="text-destructive">
        Access Denied: Administrator privileges required.
      </p>
    );
  }

  // Handle unauthenticated state if session check finishes and user is not logged in
  if (sessionStatus === "unauthenticated") {
    // This might be redundant if the parent page handles redirection, but good practice
    return <p>Please log in to manage settings.</p>;
  }

  // Use a form element and the server action
  // Use a form element and the server action
  return (
    // Pass formAction directly to the form's action prop
    // Only use the action prop for server action submission; do not use onSubmit to avoid React rendering errors
    <form
      action={formAction}
      className="space-y-4"
    >
      <h3 className="text-lg font-medium">SteamGridDB Integration</h3>
      <div className="space-y-2">
        <Label htmlFor="steamgriddb-apikey">API Key</Label>
        {/* Add name="apiKey" for form submission */}
        <Input
          id="steamgriddb-apikey"
          name="apiKey"
          type="password"
          value={apiKey} // Keep controlled component for clearing
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter new API Key (optional)"
          aria-describedby="apiKey-error" // For accessibility
          disabled={isPending} // Use isPending from useTransition
        />
        <p className="text-sm text-muted-foreground">
          Current Status: <span className="font-semibold">{apiKeyStatus}</span>
          <br />
          Leave blank to keep the existing key. Enter a new key to update it.
          The key is never displayed.
        </p>
        {/* Display API key validation errors */}
        {state.errors?.apiKey && (
          <p id="apiKey-error" className="text-sm text-destructive">
            {state.errors.apiKey.join(", ")}
          </p>
        )}
        {/* Optional: Add API Key Test button here */}
      </div>
      <div className="flex items-center space-x-2">
        {/* Add name="enabled" and handle checked state */}
        <Switch
          id="steamgriddb-enabled"
          name="enabled"
          // Use 'defaultChecked' for uncontrolled component behavior with form actions,
          // but keep 'checked' and 'onCheckedChange' for immediate UI feedback (controlled)
          // The actual value sent will be based on the hidden input if using that pattern,
          // or the 'on' value if submitted directly.
          // Let's stick to controlled for now and ensure the action reads it correctly.
          checked={isEnabled}
          onCheckedChange={setIsEnabled}
          disabled={isPending} // Use isPending
        />
        <Label htmlFor="steamgriddb-enabled">Enable SteamGridDB Provider</Label>
      </div>{" "}
      {/* Close flex div */}
      {/* Display general form errors */}
      {state.errors?._form && (
        <p className="text-sm text-destructive">
          {state.errors._form.join(", ")}
        </p>
      )}
      {/* Use type="submit" */}
      {/* Use type="submit" and disable based on isPending */}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save Settings"}
      </Button>
    </form> // Close form tag
  );
}

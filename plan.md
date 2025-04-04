# Plan: Implement User-Specific Clients in Configuration

**Goal:** Refactor the configuration management (`src/lib/config.ts`) and the TOML structure (`config/default.toml`) to store client device information exclusively within each user's data, removing the problematic top-level `clients` array.

**Relevant Type (`src/types/client.d.ts` - assumed structure based on existing code):**

```typescript
export interface ClientDevice {
  id: string; // Corresponds to ClientID
  friendly_name: string; // Corresponds to FriendlyName
  pair_secret: string; // Corresponds to PairSecret
}
```

**Steps:**

1.  **Update `UserConfig` Interface (`src/lib/config.ts`):**

    - Ensure the `clients` property is defined as `clients: ClientDevice[]`. (This seems to be already correct based on the import). No changes likely needed here, but confirm.

2.  **Update `isValidConfig` Function (`src/lib/config.ts`):**

    - **Remove** the check for the top-level `clients` key (`typeof c.clients === 'object' && c.clients !== null`).
    - _(Optional but recommended)_ Add a check within the function to iterate through `Object.values(c.users)` and verify that each `user` object has a `clients` property which is an array (`Array.isArray(user.clients)`). This makes the validation more robust.

3.  **Update `loadConfig` Function (`src/lib/config.ts`):**

    - **Remove** the code block that checks for and initializes `parsedConfig.clients` (the top-level one):
      ```typescript
      // Remove this block
      if (!parsedConfig.clients || !Array.isArray(parsedConfig.clients)) {
        logger.warn(
          LogComponent.SYSTEM,
          `Top-level 'clients' array missing in loaded config, initializing empty array.`
        );
        parsedConfig.clients = [];
      }
      ```
    - Keep the existing loop that iterates through `Object.values(parsedConfig.users)` and ensures `user.clients` exists and is an array. This correctly handles initialization for individual users.

4.  **Update `saveConfig` Function (`src/lib/config.ts`):**

    - **Remove** the code block that checks for and initializes `config.clients` (the top-level one) before saving:
      ```typescript
      // Remove this block
      if (!config.clients || !Array.isArray(config.clients)) {
        logger.warn(
          LogComponent.SYSTEM,
          "Top-level 'clients' array missing before save, initializing empty array."
        );
        config.clients = [];
      }
      ```
    - Modify the `encryptedConfig` object structure to **exclude** the top-level `clients` key entirely:
      ```typescript
      const encryptedConfig = {
        system: config.system,
        users: Object
          .fromEntries
          // ... user mapping logic ...
          (),
        // clients: config.clients, // <-- REMOVE THIS LINE
      };
      ```
    - Keep the existing check within the user mapping logic that ensures `encryptedUser.clients` exists.

5.  **Update `config/default.toml`:**

    - **Remove** the top-level `clients = []` definition from the very beginning of the file.
    - Ensure each user definition (e.g., `[users.admin]`) explicitly includes `clients = []` if they have no clients yet. Example structure:

      ```toml
      [system]
      name = "WolfUI"
      version = "1.0.0"

      [users.admin]
      id = "1"
      username = "admin"
      # ... other admin fields ...
      clients = [
        # Example clients (if any)
        # { id = "client1", friendly_name = "ClientOne", pair_secret = "Secret123" },
        # { id = "client2", friendly_name = "ClientTwo", pair_secret = "Secret456" }
      ]
      steam_id = "..."
      steam_api_key = "..."

      [users.test1]
      id = "2"
      username = "test1"
      # ... other test1 fields ...
      clients = [] # Must exist, even if empty
      steam_id = ""
      steam_api_key = ""

      # NO top-level 'clients' key anywhere in the file
      ```

6.  **Verify Client Management Functions (`src/lib/config.ts`):**

    - Double-check `addUserClient` and `removeUserClient` to ensure they correctly access `user.clients` and use the property names defined in the `ClientDevice` interface (`id`, `friendly_name`, `pair_secret`). (Existing code seems correct).

7.  **Revert Temporary Logging Changes (`src/lib/config.ts`):**

    - Change the `WARN` level logs we added for debugging back to `DEBUG` in `loadConfig`, `saveConfig`, and `validateUser`. We can tackle the logger level issue separately later.

8.  **Testing:**
    - Restart the application.
    - Verify successful login.
    - Test adding a new user (ensure `clients = []` is saved correctly).
    - Test adding a client to a user.
    - Test removing a client from a user.
    - Test removing a user.
    - Inspect `config/default.toml` after changes to confirm the structure is correct and no top-level `clients` key reappears.

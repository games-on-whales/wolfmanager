import bcrypt from "bcryptjs";
import { loadConfig, saveConfig } from "../lib/config";
import { logger } from "../lib/logger"; // Import the singleton instance
import { LogComponent } from "../lib/logger/types";

// Use the imported singleton logger instance directly

async function rehashPasswords() {
  try {
    logger.info(LogComponent.AUTH, "Starting password rehash process");

    // Load the current config
    const config = loadConfig(false);
    let updatedCount = 0;

    // Process each user
    for (const [username, user] of Object.entries(config.users)) {
      if (user.password_hash.startsWith("$2b$")) {
        // This is a native bcrypt hash, we need to rehash it
        logger.debug(LogComponent.AUTH, "Rehashing password for user", {
          username,
        });

        // For the admin user with the default password
        if (username === "admin" && !user.has_changed_password) {
          // We know the default password is "admin"
          const newHash = bcrypt.hashSync("admin", 10);
          user.password_hash = newHash;
          updatedCount++;
        } else {
          // For other users, we need to set a temporary password
          const tempPassword = "ChangeMe123!";
          const newHash = bcrypt.hashSync(tempPassword, 10);
          user.password_hash = newHash;
          user.has_changed_password = false; // Force password change
          updatedCount++;

          logger.info(LogComponent.AUTH, "Set temporary password for user", {
            username,
            tempPassword,
          });
        }
      }
    }

    // Save the updated config
    saveConfig(config);

    logger.info(LogComponent.AUTH, "Password rehash complete", {
      usersUpdated: updatedCount,
    });

    console.log(`
Password Rehash Complete
-----------------------
Updated ${updatedCount} users.

For the admin user:
- If password was never changed: use "admin"
- If password was changed: use "ChangeMe123!"

For all other users:
- Temporary password set to: "ChangeMe123!"
- Users will be required to change their password on next login
    `);
  } catch (error) {
    logger.error(
      LogComponent.AUTH,
      "Error during password rehash",
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }
}

rehashPasswords().catch(console.error);

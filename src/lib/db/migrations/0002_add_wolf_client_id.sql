-- Migration: Add wolfClientId column to client_devices table
-- This migration adds the wolfClientId field to separate database UUIDs from Wolf API client IDs

-- SQLite version
-- Add the new column
ALTER TABLE client_devices ADD COLUMN wolf_client_id TEXT;

-- Update existing records to use a placeholder value (they will need to be re-paired)
UPDATE client_devices SET wolf_client_id = 'NEEDS_REPAIRING_' || id WHERE wolf_client_id IS NULL;

-- Make the column NOT NULL
-- Note: SQLite doesn't support adding NOT NULL constraints directly, 
-- so we'll handle this in the application logic for now

-- Add index for wolf_client_id
CREATE INDEX IF NOT EXISTS client_devices_wolf_client_id_idx ON client_devices(wolf_client_id);

-- Add unique constraint for user_id + wolf_client_id
CREATE UNIQUE INDEX IF NOT EXISTS client_devices_user_id_wolf_client_id_unique_idx 
ON client_devices(user_id, wolf_client_id);

-- Remove old unique constraint for user_id + id (if it exists)
-- Note: SQLite doesn't support dropping constraints directly, so we'll leave the old one
-- The application will use the new constraint going forward

-- PostgreSQL version (commented out for now, will be uncommented when needed)
-- ALTER TABLE client_devices ADD COLUMN wolf_client_id VARCHAR(255);
-- UPDATE client_devices SET wolf_client_id = 'NEEDS_REPAIRING_' || id WHERE wolf_client_id IS NULL;
-- ALTER TABLE client_devices ALTER COLUMN wolf_client_id SET NOT NULL;
-- CREATE INDEX client_devices_wolf_client_id_idx ON client_devices(wolf_client_id);
-- CREATE UNIQUE INDEX client_devices_user_id_wolf_client_id_unique_idx ON client_devices(user_id, wolf_client_id);

-- MySQL version (commented out for now, will be uncommented when needed)
-- ALTER TABLE client_devices ADD COLUMN wolf_client_id VARCHAR(255);
-- UPDATE client_devices SET wolf_client_id = CONCAT('NEEDS_REPAIRING_', id) WHERE wolf_client_id IS NULL;
-- ALTER TABLE client_devices MODIFY wolf_client_id VARCHAR(255) NOT NULL;
-- CREATE INDEX client_devices_wolf_client_id_idx ON client_devices(wolf_client_id);
-- CREATE UNIQUE INDEX client_devices_user_id_wolf_client_id_unique_idx ON client_devices(user_id, wolf_client_id);
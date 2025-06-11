-- Migration: Add unique constraints to client_devices table

-- Step 1: Handle existing duplicates for (user_id, id)
-- Keep the most recent record (based on created_at, then rowid) and remove older ones.
DELETE FROM client_devices
WHERE rowid NOT IN (
    SELECT rowid
    FROM (
        SELECT rowid,
               ROW_NUMBER() OVER (PARTITION BY user_id, id ORDER BY created_at DESC, rowid DESC) as rn
        FROM client_devices
    )
    WHERE rn = 1
);

-- Step 2: Handle existing duplicates for (user_id, pair_secret)
-- Keep the most recent record (based on created_at, then rowid) and remove older ones.
-- This runs on the data potentially modified by Step 1.
DELETE FROM client_devices
WHERE rowid NOT IN (
    SELECT rowid
    FROM (
        SELECT rowid,
               ROW_NUMBER() OVER (PARTITION BY user_id, pair_secret ORDER BY created_at DESC, rowid DESC) as rn
        FROM client_devices
    )
    WHERE rn = 1
);

-- Step 3: Add unique constraints
-- These will fail if duplicates were not properly handled in steps 1 & 2.
CREATE UNIQUE INDEX IF NOT EXISTS client_devices_user_id_id_unique_idx ON client_devices(user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS client_devices_user_id_pair_secret_unique_idx ON client_devices(user_id, pair_secret);
import { LogComponent, logger } from "@/lib/logger";
import { getInternalBaseUrl } from "@/lib/url-resolver";
import fs from "fs/promises";
import path from "path";
// Use global fetch instead of undici to avoid compatibility issues

// Use our internal API endpoint instead of direct SteamGridDB API
// Use absolute URL for server-side fetch compatibility
const INTERNAL_API_URL = getInternalBaseUrl();
const API_BASE = `${INTERNAL_API_URL}/api/metadata/steamgriddb`;
const ASSETS_BASE_PATH = path.resolve(process.cwd(), "config/assets"); // Use absolute path for reliability

// --- Types ---

// Basic types, can be expanded based on actual API response structure
interface SteamGridDbImage {
  id: number;
  score: number;
  style: string;
  url: string;
  thumb: string;
  tags: string[];
  author: {
    name: string;
    steam64: string;
    avatar: string;
  };
  // Add other relevant fields: width, height, mime, nsfw, humorous, notes, language, lock, downvotes, upvotes, epin
}

type ArtworkType = "grid"; // Only grid artwork

interface FetchOptions {
  appId: string;
  types?: ArtworkType[]; // Defaults to all types if not provided
  // Add options for styles, dimensions, nsfw, humorous etc. later
}

interface StoredArtworkPaths {
  grid?: string; // Only store grid artwork path
}

// --- Constants ---

const DEFAULT_ARTWORK_TYPES: ArtworkType[] = ["grid"]; // Only grid artwork
const ALLOWED_EXTENSIONS: Record<ArtworkType, string[]> = {
  grid: ["png", "jpg", "jpeg", "webp"], // Supported extensions for grid artwork
};

// --- Helper Functions ---

async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dirname = path.dirname(filePath);
  try {
    await fs.access(dirname);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.mkdir(dirname, { recursive: true });
      logger.debug(LogComponent.STEAM, `Created directory: ${dirname}`);
    } else {
      throw error; // Re-throw other errors
    }
  }
}

function getFileExtensionFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const ext = path.extname(parsedUrl.pathname).toLowerCase().substring(1);
    return ext || null; // Return null if no extension found
  } catch (e) {
    logger.warn(
      LogComponent.STEAM,
      `Could not parse URL to get extension: ${url}`
    );
    return null;
  }
}

function selectBestImage(
  images: SteamGridDbImage[],
  preferredExtensions: string[]
): SteamGridDbImage | null {
  if (!images || images.length === 0) {
    return null;
  }
  // Basic selection: highest score first. Can be enhanced later.
  // TODO: Add filtering by preferredExtensions
  // TODO: Add more sophisticated selection logic (styles, dimensions, non-animated preference?)
  images.sort((a, b) => b.score - a.score);
  return images[0];
}

// --- Core Functions ---

/**
 * Fetches artwork metadata from SteamGridDB for a given Steam AppID.
 * @param options - Fetch options including API key and AppID.
 * @returns A map of artwork types to their best available image metadata.
 */
/**
 * Fetches artwork metadata from our API endpoint, which proxies to SteamGridDB.
 * @param options - Fetch options including AppID and types.
 * @returns A map of artwork types to their best available image metadata.
 */
async function fetchArtworkMetadata(
  options: FetchOptions
): Promise<Partial<Record<ArtworkType, SteamGridDbImage>>> {
  const { appId, types = DEFAULT_ARTWORK_TYPES } = options;
  const results: Partial<Record<ArtworkType, SteamGridDbImage>> = {};

  // API key is managed by the backend API, not needed here
  const headers = {
    "User-Agent": "WolfManager-Task/1.0.0", // Use correct agent for task requests
  };

  for (const type of types) {
    const url = `${API_BASE}/${type}/${appId}?styles=official&dimensions=600x900`; // Only 600x900 dimension
    logger.info(
      LogComponent.STEAM,
      `Fetching ${type} artwork for AppID ${appId} via API...`
    );

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        // Handle non-200 responses
        logger.error(
          LogComponent.STEAM,
          `API request failed for ${type} (${appId}): ${response.status} ${response.statusText}`
        );
        continue;
      }

      const data = (await response.json()) as {
        success: boolean;
        data: SteamGridDbImage[];
      };

      if (!data.success || !data.data || data.data.length === 0) {
        logger.warn(
          LogComponent.STEAM,
          `No ${type} artwork found for AppID ${appId}.`
        );
        continue;
      }

      const bestImage = selectBestImage(data.data, ALLOWED_EXTENSIONS[type]);

      if (bestImage) {
        results[type] = bestImage;
        logger.debug(
          LogComponent.STEAM,
          `Selected best ${type} for ${appId}: ${bestImage.url}`
        );
      }
    } catch (error: any) {
      // Handle fetch errors
      logger.error(
        LogComponent.STEAM,
        `Error fetching ${type} artwork for AppID ${appId}: ${error.message}`,
        { error }
      );
    }
  }

  return results;
}

/**
 * Downloads and stores artwork based on fetched metadata.
 * @param appId - The Steam AppID.
 * @param artworkMetadata - The metadata fetched from SteamGridDB.
 * @returns An object containing the local paths to the stored artwork.
 */
/**
 * Downloads and stores artwork based on fetched metadata.
 * @param appId - The Steam AppID.
 * @param artworkMetadata - The metadata fetched from the API.
 * @returns An object containing the local paths to the stored artwork.
 */
async function downloadAndStoreArtwork(
  appId: string,
  artworkMetadata: Partial<Record<ArtworkType, SteamGridDbImage>>
): Promise<StoredArtworkPaths> {
  const storedPaths: StoredArtworkPaths = {};
  const gridsDir = path.join(ASSETS_BASE_PATH, "grids"); // Store in the grids directory

  for (const type in artworkMetadata) {
    const artworkType = type as ArtworkType;
    const image = artworkMetadata[artworkType];

    if (!image) continue;

    const imageUrl = image.url;
    let extension = getFileExtensionFromUrl(imageUrl);

    if (!extension || !ALLOWED_EXTENSIONS[artworkType].includes(extension)) {
      logger.warn(
        LogComponent.STEAM,
        `Artwork URL for ${appId}/${artworkType} has unexpected extension '${extension}'. URL: ${imageUrl}`
      );
      extension = ALLOWED_EXTENSIONS[artworkType][0]; // Fallback to the first preferred extension
    }

    const filename = `${appId}.${extension}`; // Use appId as the filename
    const filePath = path.join(gridsDir, filename);

    try {
      await ensureDirectoryExists(filePath);
      logger.info(
        LogComponent.STEAM,
        `Downloading ${artworkType} for AppID ${appId} to ${filePath}...`
      );

      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        logger.error(
          LogComponent.STEAM,
          `Failed to download image from ${imageUrl}: ${response.status} ${response.statusText}`
        );
        continue;
      }

      const imageBuffer = await response.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(imageBuffer));

      storedPaths[artworkType] = path.relative(process.cwd(), filePath); // Store relative path
      logger.info(
        LogComponent.STEAM,
        `Successfully stored ${artworkType} for AppID ${appId} at ${filePath}`
      );
    } catch (error: any) {
      logger.error(
        LogComponent.STEAM,
        `Error downloading or saving ${artworkType} for AppID ${appId} from ${imageUrl}: ${error.message}`,
        { error }
      );
    }
  }

  return storedPaths;
}

/**
 * Fetches, selects, downloads, and stores artwork for a given Steam game.
 * @param apiKey - Your SteamGridDB API key.
 * @param appId - The Steam AppID of the game.
 * @returns An object containing the local paths to the stored artwork.
 */
/**
 * Fetches, selects, downloads, and stores artwork for a given Steam game.
 * @param appId - The Steam AppID of the game.
 * @returns An object containing the local paths to the stored artwork.
 */
export async function getAndStoreSteamArtwork(
  appId: string
): Promise<StoredArtworkPaths> {
  logger.info(
    LogComponent.STEAM,
    `Starting artwork fetch process for AppID: ${appId}`
  );

  try {
    // We don't need to pass the API key anymore as it's managed by the API
    const metadata = await fetchArtworkMetadata({ appId });

    if (Object.keys(metadata).length === 0) {
      logger.warn(
        LogComponent.STEAM,
        `No artwork metadata found for AppID ${appId}. Nothing to download.`
      );
      return {};
    }

    const storedPaths = await downloadAndStoreArtwork(appId, metadata);
    logger.info(
      LogComponent.STEAM,
      `Artwork processing finished for AppID: ${appId}. Stored paths: ${JSON.stringify(
        storedPaths
      )}`
    );
    return storedPaths;
  } catch (error: any) {
    logger.error(
      LogComponent.STEAM,
      `Failed to get and store artwork for AppID ${appId}: ${error.message}`,
      { error }
    );
    throw error; // Re-throw for now, allows caller to handle
  }
}

// --- Example Usage (for testing purposes) ---
/*
// Example test function
async function test() {
    const TEST_APP_ID = '400'; // Portal 2

    try {
        const paths = await getAndStoreSteamArtwork(TEST_APP_ID);
        console.log("Test completed. Stored artwork paths:", paths);
    } catch (error) {
        console.error("Test failed:", error);
    }
}

// Uncomment to run test:
// test();
*/

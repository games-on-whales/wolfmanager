import { syncSteamLibrary } from "../../../actions/steam-library";

export async function POST() {
  try {
    const result = await syncSteamLibrary();
    return Response.json(result);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return Response.json({ success: false, error: errorMessage });
  }
}

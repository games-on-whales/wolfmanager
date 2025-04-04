import {
  API_ERROR_CODES,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/api-utils";
import { authOptions } from "@/lib/auth";
import { loadConfig, saveConfig } from "@/lib/config";
import { LogComponent, logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/users
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return NextResponse.json(
        createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const config = loadConfig();
    const user = config.users[session.user.name];

    if (!user) {
      await logger.error(
        LogComponent.WOLF_UI,
        `Failed to get clients: User ${session.user.name} not found`
      );
      return NextResponse.json(
        createErrorResponse("User not found", API_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse({ clients: user.clients }));
  } catch (error) {
    await logger.error(
      LogComponent.WOLF_UI,
      "Error getting user clients",
      error
    );
    return NextResponse.json(
      createErrorResponse(
        "Failed to get clients",
        API_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

// POST /api/users
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return NextResponse.json(
        createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { deviceId, friendlyName, pairSecret } = await req.json();

    if (!deviceId || !friendlyName || !pairSecret) {
      return NextResponse.json(
        createErrorResponse(
          "Missing required fields",
          API_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const config = loadConfig();
    const user = config.users[session.user.name];

    if (!user) {
      await logger.error(
        LogComponent.WOLF_UI,
        `Failed to add client: User ${session.user.name} not found`
      );
      return NextResponse.json(
        createErrorResponse("User not found", API_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    // Check if client already exists
    if (user.clients.some((client) => client.id === deviceId)) {
      await logger.warn(
        LogComponent.WOLF_UI,
        `Client ${deviceId} already paired with user ${session.user.name}`
      );
      return NextResponse.json(
        createErrorResponse(
          "Client already paired",
          API_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const newClient = {
      id: deviceId,
      friendly_name: friendlyName,
      pair_secret: pairSecret,
    };

    user.clients.push(newClient);
    saveConfig(config);

    await logger.info(
      LogComponent.WOLF_UI,
      `Added client ${deviceId} to user ${session.user.name}`
    );

    return NextResponse.json(createSuccessResponse({ client: newClient }));
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error adding client", error);
    return NextResponse.json(
      createErrorResponse(
        "Failed to add client",
        API_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

// DELETE /api/users
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return NextResponse.json(
        createErrorResponse("Unauthorized", API_ERROR_CODES.UNAUTHORIZED),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json(
        createErrorResponse(
          "Device ID is required",
          API_ERROR_CODES.VALIDATION_ERROR
        ),
        { status: 400 }
      );
    }

    const config = loadConfig();
    const user = config.users[session.user.name];

    if (!user) {
      await logger.error(
        LogComponent.WOLF_UI,
        `Failed to remove client: User ${session.user.name} not found`
      );
      return NextResponse.json(
        createErrorResponse("User not found", API_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    const clientIndex = user.clients.findIndex(
      (client) => client.id === deviceId
    );

    if (clientIndex === -1) {
      await logger.warn(
        LogComponent.WOLF_UI,
        `Client ${deviceId} not found for user ${session.user.name}`
      );
      return NextResponse.json(
        createErrorResponse("Client not found", API_ERROR_CODES.NOT_FOUND),
        { status: 404 }
      );
    }

    const removedClient = user.clients[clientIndex];
    user.clients.splice(clientIndex, 1);
    saveConfig(config);

    await logger.info(
      LogComponent.WOLF_UI,
      `Removed client ${deviceId} from user ${session.user.name}`
    );

    return NextResponse.json(createSuccessResponse({ client: removedClient }));
  } catch (error) {
    await logger.error(LogComponent.WOLF_UI, "Error removing client", error);
    return NextResponse.json(
      createErrorResponse(
        "Failed to remove client",
        API_ERROR_CODES.INTERNAL_ERROR
      ),
      { status: 500 }
    );
  }
}

import { authOptions } from "@/lib/auth";
import { callWolfApi } from "@/app/api/wolf/lib/wolf-socket.server";
import { isValidWolfEndpoint } from "@/app/api/wolf/lib/schema";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import http from "http";

const WOLF_SOCKET_PATH = "/var/run/wolf/wolf.sock";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    user: session.user.name,
    tests: {}
  };

  // Test 1: Check socket file existence and permissions
  try {
    const socketExists = fs.existsSync(WOLF_SOCKET_PATH);
    diagnostics.tests.socketFile = {
      exists: socketExists,
      path: WOLF_SOCKET_PATH
    };

    if (socketExists) {
      const stats = fs.statSync(WOLF_SOCKET_PATH);
      diagnostics.tests.socketFile.permissions = {
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid,
        isSocket: stats.isSocket(),
        size: stats.size
      };
    }
  } catch (error) {
    diagnostics.tests.socketFile = {
      error: error instanceof Error ? error.message : String(error)
    };
  }

  // Test 2: Check environment variables
  diagnostics.tests.environment = {
    nodeEnv: process.env.NODE_ENV,
    user: process.env.USER,
    uid: process.getuid?.(),
    gid: process.getgid?.(),
    dockerEnv: fs.existsSync("/.dockerenv"),
    remoteContainers: process.env.REMOTE_CONTAINERS,
    codespaces: process.env.CODESPACES
  };

  // Test 3: Test Wolf API endpoint validation
  try {
    const pairPendingValid = await isValidWolfEndpoint("/pair/pending", "GET");
    const clientsValid = await isValidWolfEndpoint("/clients", "GET");
    
    diagnostics.tests.endpointValidation = {
      pairPending: pairPendingValid,
      clients: clientsValid
    };
  } catch (error) {
    diagnostics.tests.endpointValidation = {
      error: error instanceof Error ? error.message : String(error)
    };
  }

  // Test 4: Test direct Wolf API calls
  try {
    console.log("[WOLF_DEBUG] Testing /pair/pending endpoint...");
    const pendingResponse = await callWolfApi("/pair/pending");
    diagnostics.tests.wolfApiPending = {
      success: true,
      response: pendingResponse,
      responseType: typeof pendingResponse
    };
  } catch (error) {
    diagnostics.tests.wolfApiPending = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
  }

  try {
    console.log("[WOLF_DEBUG] Testing /clients endpoint...");
    const clientsResponse = await callWolfApi("/clients");
    diagnostics.tests.wolfApiClients = {
      success: true,
      response: clientsResponse,
      responseType: typeof clientsResponse
    };
  } catch (error) {
    diagnostics.tests.wolfApiClients = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
  }

  // Test 5: Test raw socket connection
  try {
    const testSocketConnection = await new Promise((resolve, reject) => {
      const req = http.request({
        socketPath: WOLF_SOCKET_PATH,
        path: '/api/v1/ping',
        method: 'GET',
        timeout: 5000
      }, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        }));
      });
      
      req.on('error', (error: any) => reject(error));
      req.on('timeout', () => reject(new Error('Socket connection timeout')));
      req.end();
    });

    diagnostics.tests.rawSocketConnection = {
      success: true,
      response: testSocketConnection
    };
  } catch (error) {
    diagnostics.tests.rawSocketConnection = {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
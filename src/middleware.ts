import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { logger } from "./lib/logger";
import { LogComponent } from "./lib/logger/types";

// Define paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/register",
  "/first-time-setup",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/error/unauthorized",
  "/error/forbidden",
  "/error/expired",
];

// Define paths that require admin access
const adminPaths = [
  "/admin",
  "/users",
  "/api/users",
  "/api/admin",
  "/api/system",
  "/api/wolf/admin",
  "/settings/api-test",
];

// API endpoints that require authentication but not admin
const protectedApiPaths = [
  "/api/user",
  "/api/wolf",
  "/api/libraries",
  "/api/settings",
];

export default withAuth(
  async function middleware(req: any) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    await logger.debug(LogComponent.AUTH, "Middleware processing protected route", {
      pathname,
      hasToken: !!token,
      userId: token?.id,
      userRole: token?.role,
      requiresFirstTimeSetup: token?.requiresFirstTimeSetup,
    });

    // Check for expired or invalid session
    if (!token || token.error === "SessionExpired") {
      // Special case: for root path with no token, redirect to login (normal behavior)
      if (pathname === "/" && !token) {
        await logger.debug(LogComponent.AUTH, "Unauthenticated user accessing root path, redirecting to login", {
          path: pathname
        });
        return NextResponse.redirect(new URL("/login", req.url));
      }

      // Log actual auth issues (expired sessions, invalid tokens, or protected routes)
      if (token?.error === "SessionExpired" || (token && !token.id)) {
        await logger.warn(LogComponent.AUTH, "Authentication issue detected", {
          path: pathname,
          error: token?.error || "InvalidToken",
          hasToken: !!token,
        });
      } else {
        await logger.debug(LogComponent.AUTH, "Unauthenticated access to protected route", {
          path: pathname,
        });
      }

      // For API routes, return 401
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // For non-API routes, redirect to unauthorized page
      const url = new URL("/error/unauthorized", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    // Enforce first-time setup for authenticated users who haven't completed it
    if (token && token.requiresFirstTimeSetup && pathname !== "/first-time-setup") {
      await logger.info(LogComponent.AUTH, "Redirecting user to first-time setup", {
        path: pathname,
        userId: token.id,
        destination: "/first-time-setup",
      });
      
      // For API routes, return 403 with specific message
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({
          error: "First-time setup required",
          redirectTo: "/first-time-setup"
        }, { status: 403 });
      }
      
      // For non-API routes, redirect to first-time setup
      return NextResponse.redirect(new URL("/first-time-setup", req.url));
    }

    // Allow public paths if no token or first-time setup is not required
    if (publicPaths.some((path) => pathname.startsWith(path))) {
      // Special handling for root path
      if (pathname === "/") {
        if (token) {
          await logger.debug(LogComponent.AUTH, "Authenticated user accessing root path, redirecting to clients", {
            userId: token.id,
          });
          // If authenticated and not requiring setup, redirect to clients page
          return NextResponse.redirect(new URL("/clients", req.url));
        } else {
          await logger.debug(LogComponent.AUTH, "Unauthenticated user accessing root path, redirecting to login");
          // If not authenticated, redirect to login
          return NextResponse.redirect(new URL("/login", req.url));
        }
      }
      return NextResponse.next();
    }

    // Log access attempt for protected routes
    await logger.debug(LogComponent.AUTH, "Protected route access attempt", {
      path: pathname,
      hasToken: !!token,
      userRole: token?.role || "none",
      requiresFirstTimeSetup: token?.requiresFirstTimeSetup,
    });

      // Check for admin-only routes
      if (adminPaths.some((path) => pathname.startsWith(path))) {
        if (token.role !== "admin") {
          await logger.warn(
            LogComponent.AUTH,
            "Unauthorized admin access attempt",
            {
              path: pathname,
              userId: token.id,
              userRole: token.role,
            }
          );

          // For API routes, return 403
          if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }

          // For non-API routes, redirect to forbidden page
          return NextResponse.redirect(new URL("/error/forbidden", req.url));
        }

        await logger.info(LogComponent.AUTH, "Admin route accessed", {
          path: pathname,
          userId: token.id,
        });
      }

      // Check for protected API routes
      if (protectedApiPaths.some((path) => pathname.startsWith(path))) {
        await logger.debug(LogComponent.AUTH, "Protected API route accessed", {
          path: pathname,
          userId: token.id,
          userRole: token.role,
        });
      }

      return NextResponse.next();
    },
    {
      callbacks: {
        authorized: ({ token }: { token: any }) => {
          // Return true to allow the middleware to handle the response
          return true;
        },
      },
    }
  );

// Configure the paths that trigger the middleware
export const config = {
  matcher: [
    // Only run middleware on paths that actually need authentication checks
    // Exclude public paths, static assets, and auth endpoints
    "/((?!_next/static|_next/image|favicon.ico|login|register|first-time-setup|error|api/auth).*)",
    // Include specific API routes that need auth
    "/api/user/:path*",
    "/api/wolf/:path*",
    "/api/libraries/:path*",
    "/api/settings/:path*",
    "/api/users/:path*",
    "/api/admin/:path*",
    "/api/system/:path*",
  ],
  // Force Node.js runtime to avoid Edge Runtime issues with TOML/crypto
  runtime: 'nodejs',
};

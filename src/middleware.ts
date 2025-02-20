import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Define paths that don't require authentication
const publicPaths = ["/login", "/register", "/api/auth"];
// Define paths that require admin access
const adminPaths = ["/admin", "/users"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is public
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Get the token and verify authentication
  const token = await getToken({ req: request });

  // If no token and trying to access protected route, redirect to login
  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Check for admin-only routes
  if (
    adminPaths.some((path) => pathname.startsWith(path)) &&
    token.role !== "admin"
  ) {
    // Redirect non-admin users to homepage if they try to access admin routes
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Configure the paths that trigger the middleware
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

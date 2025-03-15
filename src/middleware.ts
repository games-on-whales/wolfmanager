import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Define paths that don't require authentication
const publicPaths = ["/login", "/register", "/api/auth"];
// Define paths that require admin access
const adminPaths = ["/admin", "/users"];

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Allow public paths
    if (publicPaths.some((path) => pathname.startsWith(path))) {
      return NextResponse.next();
    }

    // Check for expired or invalid session
    if (!token || token.error === "SessionExpired") {
      const url = new URL("/login", req.url);
      url.searchParams.set("error", "SessionExpired");
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    // Check for admin-only routes
    if (
      adminPaths.some((path) => pathname.startsWith(path)) &&
      token.role !== "admin"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Return true to allow the middleware to handle the response
        return true;
      },
    },
  }
);

// Configure the paths that trigger the middleware
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};

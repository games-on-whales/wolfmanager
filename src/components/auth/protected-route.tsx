"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    // You could replace this with a proper loading component
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    redirect("/error/unauthorized");
  }

  if (requireAdmin && session?.user?.role !== "admin") {
    redirect("/error/forbidden");
  }

  return <>{children}</>;
}

// HOC for pages that require authentication
export function withAuth(Component: React.ComponentType, requireAdmin = false) {
  return function ProtectedComponent(props: any) {
    return (
      <ProtectedRoute requireAdmin={requireAdmin}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

interface WithAuthProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function WithAuth({ children, requireAdmin = false }: WithAuthProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  if (requireAdmin && session?.user?.role !== "admin") {
    redirect("/");
  }

  return <>{children}</>;
}

// HOC for pages that require authentication
export function withAuth(Component: React.ComponentType, requireAdmin = false) {
  return function ProtectedRoute(props: any) {
    return (
      <WithAuth requireAdmin={requireAdmin}>
        <Component {...props} />
      </WithAuth>
    );
  };
}

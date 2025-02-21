"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export function PageLayout({ children, title, description }: PageLayoutProps) {
  const router = useRouter();

  return (
    <div className="container py-6 space-y-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

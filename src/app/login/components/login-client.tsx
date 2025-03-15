"use client";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConstellationBackground } from "@/components/ui/constellation-bg";
import { GameControls } from "@/components/ui/game-controls";
import { SpaceInvaders } from "@/components/ui/space-invaders";
import { StarfieldBackground } from "@/components/ui/starfield-bg";
import { LogComponent, clientLogger } from "@/lib/logger";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LoginClientProps {
  isFirstTimeSetup: boolean;
  initialSession: Session | null;
  error?: string;
  callbackUrl?: string;
}

export function LoginClient({
  isFirstTimeSetup,
  initialSession,
  error,
  callbackUrl,
}: LoginClientProps) {
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (error === "SessionExpired") {
      clientLogger.info(
        LogComponent.AUTH,
        "Session expired - showing notification"
      );
      showToast.error(
        "Session Expired",
        "Your session has expired. Please log in again."
      );
    }
  }, [error]);

  const handleLoginSuccess = (isFirstLogin: boolean) => {
    if (isFirstLogin) {
      router.push("/first-time-setup");
    } else {
      router.push(callbackUrl || "/dashboard");
    }
  };

  const handleLogoClick = () => {
    setShowEasterEgg(!showEasterEgg);
  };

  return (
    <>
      <StarfieldBackground />
      <ConstellationBackground />
      <div className="login-page flex min-h-screen items-center justify-center bg-transparent">
        {showEasterEgg && (
          <div
            className="fixed top-0 left-0 bottom-0 w-[40vw] z-0 transition-all duration-500"
            style={{
              background: "rgba(0, 0, 0, 0.3)",
              backdropFilter: "blur(8px)",
            }}
          />
        )}
        <div
          className={cn(
            "relative z-10 w-full max-w-md px-4 transition-all duration-500",
            showEasterEgg && "translate-x-[-30vw]"
          )}
        >
          <Card className="border-muted/20 bg-card/60 shadow-lg backdrop-blur-md backdrop-saturate-150">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex flex-col items-center space-y-4">
                <div
                  className={cn(
                    "w-16 h-16 overflow-hidden rounded-full cursor-pointer transition-all duration-300",
                    "hover:scale-110",
                    showEasterEgg &&
                      "ring-2 ring-green-500 ring-offset-2 ring-offset-background"
                  )}
                  onClick={handleLogoClick}
                  title={
                    showEasterEgg
                      ? "Click to close game"
                      : "Click for a surprise"
                  }
                >
                  <img
                    src="https://images.opencollective.com/games-on-whales/33a2797/logo/128.png?height=128"
                    alt="WolfUI Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h1 className="text-4xl font-bold tracking-tight gradient-text">
                  Wolf
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Sign in to your account
              </p>
            </CardHeader>
            <CardContent>
              <LoginForm onSuccess={handleLoginSuccess} />
            </CardContent>
          </Card>
        </div>
        {showEasterEgg && (
          <div
            className="fixed top-0 right-0 bottom-0 w-[60vw] z-20 transition-all duration-500"
            style={{
              clipPath: showEasterEgg ? "inset(0)" : "inset(0 100% 0 0)",
            }}
          >
            <div className="absolute top-4 right-4 z-30">
              <GameControls />
            </div>
            <div className="w-full h-full">
              <SpaceInvaders />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

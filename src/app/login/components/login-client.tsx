"use client";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConstellationBackground } from "@/components/ui/constellation-bg";
import { GameControls } from "@/components/ui/game-controls";
import { SpaceInvaders } from "@/components/ui/space-invaders";
import { StarfieldBackground } from "@/components/ui/starfield-bg";
import { LogComponent } from "@/lib/logger";
import { clientLogger } from "@/lib/logger/client";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LoginClientProps {
  error?: string;
  callbackUrl?: string;
  message?: string;
}

export function LoginClient({ error, callbackUrl, message }: LoginClientProps) {
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleError = async () => {
      if (error === "SessionExpired") {
        await clientLogger.info(
          LogComponent.AUTH,
          "Session expired - redirecting to login",
          {
            callbackUrl: callbackUrl,
          }
        );
        showToast.error(
          "Session Expired",
          "Your session has expired. Please log in again."
        );
      } else if (message === "setup-complete") {
        showToast.success(
          "Setup Complete",
          {
            description: "Your password has been updated successfully. Please log in with your new password."
          }
        );
      }
    };
    handleError();
  }, [error, callbackUrl, message]);

  const handleGameControllerClick = async () => {
    setShowEasterEgg(!showEasterEgg);
    await clientLogger.debug(LogComponent.WOLF_UI, "Easter egg toggled", {
      showEasterEgg: !showEasterEgg,
    });
  };

  return (
    <>
      <StarfieldBackground />
      <ConstellationBackground />
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-transparent">
        {" "}
        {/* Updated classes */}
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
            "relative z-10 w-full max-w-md transition-all duration-500", // Updated classes, removed px-4
            showEasterEgg && "translate-x-[-30vw]"
          )}
        >
          {/* Keep the Card and its content, which now uses the updated LoginForm */}
          <LoginForm onGameControllerClick={handleGameControllerClick} />
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

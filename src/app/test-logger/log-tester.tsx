"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { clientLogger } from "@/lib/logger/client";
import { LogComponent } from "@/lib/logger/types";
import { useState } from "react";

export function LogTester() {
  const [isTesting, setIsTesting] = useState(false);

  const generateTestLog = async (
    level: "debug" | "info" | "warn" | "error"
  ) => {
    setIsTesting(true);
    try {
      const timestamp = new Date().toISOString();
      const metadata = {
        test: true,
        timestamp,
        browser: navigator.userAgent,
      };

      switch (level) {
        case "debug":
          clientLogger.debug(
            LogComponent.WOLF_UI,
            "Test debug message",
            undefined,
            metadata
          );
          break;
        case "info":
          clientLogger.info(
            LogComponent.WOLF_UI,
            "Test info message",
            undefined,
            metadata
          );
          break;
        case "warn":
          clientLogger.warn(
            LogComponent.WOLF_UI,
            "Test warning message",
            undefined,
            metadata
          );
          break;
        case "error":
          clientLogger.error(
            LogComponent.WOLF_UI,
            "Test error message",
            new Error("Test error"),
            metadata
          );
          break;
      }
    } finally {
      setIsTesting(false);
    }
  };

  const generateAllLevels = async () => {
    setIsTesting(true);
    try {
      await generateTestLog("debug");
      await generateTestLog("info");
      await generateTestLog("warn");
      await generateTestLog("error");
    } finally {
      setIsTesting(false);
    }
  };

  const generateInvalidLog = () => {
    setIsTesting(true);
    try {
      // @ts-ignore - Intentionally sending invalid data
      clientLogger.info("INVALID_COMPONENT", "This should fail validation");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={() => generateTestLog("debug")}
          disabled={isTesting}
        >
          Debug Log
        </Button>
        <Button
          variant="outline"
          onClick={() => generateTestLog("info")}
          disabled={isTesting}
        >
          Info Log
        </Button>
        <Button
          variant="outline"
          onClick={() => generateTestLog("warn")}
          disabled={isTesting}
        >
          Warning Log
        </Button>
        <Button
          variant="default"
          onClick={() => generateTestLog("error")}
          disabled={isTesting}
        >
          Error Log
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={generateAllLevels}
          disabled={isTesting}
        >
          Test All Levels
        </Button>
        <Button
          variant="destructive"
          onClick={generateInvalidLog}
          disabled={isTesting}
        >
          Test Invalid Log
        </Button>
      </div>
    </Card>
  );
}

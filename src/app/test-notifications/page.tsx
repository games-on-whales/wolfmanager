"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function TestNotifications() {
  return (
    <div className="container mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Test Notifications</h1>
      <div className="flex flex-col gap-4">
        <Button
          onClick={() =>
            toast.success("Success Message", {
              description: "This is a success notification",
            })
          }
        >
          Show Success
        </Button>
        <Button
          onClick={() =>
            toast.error("Error Message", {
              description: "This is an error notification",
            })
          }
        >
          Show Error
        </Button>
        <Button
          onClick={() =>
            toast.info("Info Message", {
              description: "This is an info notification",
            })
          }
        >
          Show Info
        </Button>
        <Button
          onClick={() =>
            toast.warning("Warning Message", {
              description: "This is a warning notification",
            })
          }
        >
          Show Warning
        </Button>
        <Button
          onClick={() =>
            toast("Custom Message", {
              description: "This is a custom notification with action",
              action: {
                label: "Undo",
                onClick: () => console.log("Undo clicked"),
              },
            })
          }
        >
          Show Custom with Action
        </Button>
      </div>
    </div>
  );
}

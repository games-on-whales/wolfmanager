import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContainerLogViewer } from "@/components/wolf-logs/container-log-viewer";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Wolf Logs | Settings",
  description: "View logs from the Wolf container",
};

export default function WolfLogsPage() {
  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Wolf Container Logs
          </h1>
          <p className="text-muted-foreground">
            View and monitor logs from the Wolf container in real-time
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="glass-card border-none p-6">
          <CardHeader>
            <CardTitle>About Wolf Container Logs</CardTitle>
            <CardDescription>
              This page allows you to view logs from the Wolf container in
              real-time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The logs are streamed directly from the Docker container running
              the Wolf service. You can start and stop the log stream, clear the
              logs, and toggle auto-scrolling and timestamps. This feature is
              useful for monitoring the Wolf service and troubleshooting issues.
            </p>
          </CardContent>
        </Card>

        <ContainerLogViewer
          maxHeight="600px"
        />
      </div>
    </div>
  );
}

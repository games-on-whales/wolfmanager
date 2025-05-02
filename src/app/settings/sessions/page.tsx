"use client";

import { formatDateTimeUTC } from "@/app/clients/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";

// Mock data for sessions
const sessions = [
  {
    id: 1,
    device: "Chrome on Windows",
    ip: "192.168.1.1",
    lastActive: "2024-02-20T10:00:00",
    type: "desktop",
  },
  {
    id: 2,
    device: "Safari on iPhone",
    ip: "192.168.1.2",
    lastActive: "2024-02-20T09:30:00",
    type: "mobile",
  },
];

export default function SessionsPage() {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Active Sessions</h1>
          <p className="text-muted-foreground">
            Manage your currently active sessions
          </p>
        </div>
      </div>

      <Card className="glass-card border-none p-6">
        <CardHeader>
          <CardTitle>Current Sessions</CardTitle>
          <CardDescription>
            These are the devices that are currently logged into your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {session.type === "desktop" ? (
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Smartphone className="h-4 w-4 text-muted-foreground" />
                      )}
                      {session.device}
                    </div>
                  </TableCell>
                  <TableCell>{session.ip}</TableCell>
                  <TableCell>{formatDateTimeUTC(session.lastActive)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm">
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

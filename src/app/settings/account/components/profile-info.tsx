import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Define the session user structure as we receive it
interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

interface ProfileInfoProps {
  user: SessionUser;
  className?: string;
}

export function ProfileInfo({ user, className }: ProfileInfoProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Your account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={user?.name || ""}
            disabled
            className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            value={user?.role === "admin" ? "Administrator" : "User"}
            disabled
            className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
          />
        </div>
      </CardContent>
    </Card>
  );
}

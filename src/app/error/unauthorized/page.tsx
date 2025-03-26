import { AccessDenied } from "@/components/errors/AccessDenied";

export default function UnauthorizedPage() {
  return <AccessDenied variant="unauthorized" />;
}

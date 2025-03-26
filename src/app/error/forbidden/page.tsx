import { AccessDenied } from "@/components/errors/AccessDenied";

export default function ForbiddenPage() {
  return <AccessDenied variant="forbidden" />;
}

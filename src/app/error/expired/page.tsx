import { AccessDenied } from "@/components/errors/AccessDenied";

export default function SessionExpiredPage() {
  return <AccessDenied variant="expired" />;
}

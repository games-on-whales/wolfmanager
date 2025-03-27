import { authOptions } from "@/lib/auth";
import { LogComponent, logger } from "@/lib/logger";
import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PairDialog } from "./components/PairDialog";
import { PairedClients } from "./components/PairedClients";

export const metadata: Metadata = {
  title: "Device Pairing - Wolf Manager",
  description: "Pair your devices with Wolf Manager",
};

export default async function PairPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    await logger.debug(
      LogComponent.WOLF_UI,
      "Redirecting unauthenticated user to login"
    );
    redirect("/login");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Device Pairing</h1>
          <p className="text-muted-foreground">
            Pair your devices with Wolf Manager to enable remote management and
            synchronization.
          </p>
        </div>
        <PairDialog />
        <PairedClients />
      </div>
    </div>
  );
}

import { listClientsAndOwners } from "@/app/clients/actions";
import { type PendingPairRequest, wolfPairApi } from "@/lib/api/wolf-pair";
import { ClientDevice } from "@/types/client"; // Import ClientDevice type
import ClientPageContent from "./components/ClientPageContent";

// Define a type for the client data including the optional owner and additional properties
type ClientWithOwner = ClientDevice & {
  owner?: string;
  device_type?: string;
  last_seen?: string;
  status?: string;
  pair_secret?: string; // Include pair_secret for filtering
};

export default async function ClientsPage() {
  let initialRequests: PendingPairRequest[] = [];
  let initialPairedClients: ClientWithOwner[] = [];
  let error: string | null = null;

  try {
    // Fetch pending requests from Wolf API
    const pendingRequests = await wolfPairApi.getPendingRequests();
    if (!Array.isArray(pendingRequests)) {
      throw new Error("Invalid response format for pending requests");
    }

    // Get all confirmed paired clients (with owner info)
    const pairedClientsResponse = await listClientsAndOwners();
    const pairedClientsData: ClientWithOwner[] = pairedClientsResponse.success
      ? pairedClientsResponse.data?.clients || []
      : [];

    // Filter out pending requests whose pair_secret matches a secret stored for any paired client
    initialRequests = pendingRequests.filter(
      (request: PendingPairRequest) =>
        !pairedClientsData.some(
          (client: ClientWithOwner) =>
            client.pair_secret && client.pair_secret === request.pair_secret
        )
    );

    initialPairedClients = pairedClientsData;
  } catch (e) {
    error = "Failed to load client data.";
    console.error("Error fetching initial client data:", e);
  }

  if (error) {
    return (
      <div className="space-y-6 p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white neon-text">Clients</h1>
        <div className="glass-card border-none p-6">
          <h2 className="text-white text-xl">Error Loading Clients</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white neon-text">Clients</h1>
      <ClientPageContent
        initialRequests={initialRequests}
        initialPairedClients={initialPairedClients}
      />
    </div>
  );
}

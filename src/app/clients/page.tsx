import { listClientsAndOwners, getAllPairedClientsInternal, getPendingRequestsAction } from "@/app/clients/actions";
import { type PendingPairRequest } from "@/lib/api/wolf-pair-server";
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
    // Use server actions instead of direct API calls for server-side rendering
    const pendingRequestsResponse = await getPendingRequestsAction();
    if (!pendingRequestsResponse.success) {
      const errorMessage = typeof pendingRequestsResponse.error === 'string'
        ? pendingRequestsResponse.error
        : pendingRequestsResponse.error?.message || "Failed to fetch pending requests";
      throw new Error(errorMessage);
    }
    const pendingRequests = pendingRequestsResponse.data;
    
    if (!Array.isArray(pendingRequests)) {
      throw new Error("Invalid response format for pending requests");
    }

    // Get ALL confirmed paired clients (from all users) for filtering pending requests
    const allPairedClientsResponse = await getAllPairedClientsInternal();
    const allPairedClientsData: ClientWithOwner[] = allPairedClientsResponse.success
      ? allPairedClientsResponse.data?.clients || []
      : [];

    // Get user-specific paired clients for display
    const userPairedClientsResponse = await listClientsAndOwners();
    const userPairedClientsData: ClientWithOwner[] = userPairedClientsResponse.success
      ? userPairedClientsResponse.data?.clients || []
      : [];

    // Filter out pending requests whose pair_secret matches a secret stored for ANY paired client (from any user)
    initialRequests = pendingRequests.filter(
      (request: PendingPairRequest) =>
        !allPairedClientsData.some(
          (client: ClientWithOwner) =>
            client.pair_secret && client.pair_secret === request.pair_secret
        )
    );

    // Show only user's own paired clients
    initialPairedClients = userPairedClientsData;
  } catch (e) {
    error = `Failed to load client data: ${e instanceof Error ? e.message : String(e)}`;
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

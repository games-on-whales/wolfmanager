import { getWolfClientsAction, getPendingPairRequestsAction } from "@/app/actions/wolf-actions";
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
    // Use new server actions from wolf-actions.ts
    const pendingRequestsResponse = await getPendingPairRequestsAction();
    if (!pendingRequestsResponse.success) {
      const errorMessage = typeof pendingRequestsResponse.error === 'string'
        ? pendingRequestsResponse.error
        : pendingRequestsResponse.error?.message || "Failed to fetch pending requests";
      throw new Error(errorMessage);
    }
    const wolfPendingRequests = pendingRequestsResponse.data?.requests || [];

    // Map Wolf API pending requests to match expected interface
    initialRequests = wolfPendingRequests.map((request: any) => ({
      id: request.pair_secret, // Use pair_secret as the unique ID
      deviceType: `Device at ${request.client_ip}`, // Show client IP as device type
      timestamp: Date.now(), // Wolf API doesn't provide timestamp, use current time
      pair_secret: request.pair_secret,
    }));

    // Get paired clients using new server action
    const pairedClientsResponse = await getWolfClientsAction();
    const pairedClientsData: ClientWithOwner[] = pairedClientsResponse.success
      ? (pairedClientsResponse.data?.clients || []).map((client: any) => ({
          id: client.id || client.client_id,
          friendly_name: client.hostname || client.friendly_name || `Client ${client.id}`,
          device_type: client.device_type || 'Unknown',
          last_seen: client.last_seen,
          status: client.status || 'Unknown',
          owner: 'Current User', // Since we're getting user-specific clients
          pair_secret: client.pair_secret,
        }))
      : [];
    initialPairedClients = pairedClientsData;
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

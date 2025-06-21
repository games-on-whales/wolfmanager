"use client";

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
import { type ClientDevice } from "@/types/client";
import { Laptop, Loader2, X, Edit } from "lucide-react";
import React, { useState } from "react";
import EditClientSettingsDialog from "./EditClientSettingsDialog";

// Define a type for the client data including the optional owner and additional properties
type ClientWithOwner = ClientDevice & {
  owner?: string;
  device_type?: string;
  last_seen?: string;
  status?: string;
  wolf_client_id?: string;
  settings?: import("@/types/wolf").ClientSettings;
};

interface PairedClientsCardProps {
  pairedClients: ClientWithOwner[];
  isLoading: boolean;
  unpairingId: string | null;
  onUnpair: (deviceId: string) => void;
  onEditSuccess?: () => void;
}

const PairedClientsCard: React.FC<PairedClientsCardProps> = ({
  pairedClients,
  isLoading,
  unpairingId,
  onUnpair,
  onEditSuccess,
}) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientWithOwner | null>(null);

  const handleEditClick = (client: ClientWithOwner) => {
    setEditingClient(client);
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
    setEditingClient(null);
  };

  const handleEditSuccess = () => {
    handleEditDialogClose();
    onEditSuccess?.();
  };
  return (
    <Card className="glass-card border-none mt-6">
      <CardHeader>
        <CardTitle className="text-white">Paired Clients</CardTitle>
        <CardDescription className="text-gray-400">
          Devices connected to your streaming server
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Table className="border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.1)]">
              <TableHead className="text-[#fffb96] py-3 px-4">Name</TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4">ID</TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4">
                Device Type
              </TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4">Owner</TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4">
                Last Seen
              </TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4">Status</TableHead>
              <TableHead className="text-[#fffb96] text-right py-3 px-4">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pairedClients.map((client) => (
              <TableRow
                key={client.id}
                className="border-[rgba(255,255,255,0.1)]"
              >
                <TableCell className="font-medium text-white py-3 px-4">
                  {client.friendly_name}
                </TableCell>
                <TableCell className="text-white py-3 px-4">
                  {client.wolf_client_id || client.id}
                </TableCell>
                <TableCell className="text-white py-3 px-4">
                  {client.device_type}
                </TableCell>
                <TableCell className="text-gray-400 py-3 px-4">
                  {client.owner || "N/A"}
                </TableCell>
                <TableCell className="text-gray-400 py-3 px-4">
                  {client.last_seen
                    ? new Date(client.last_seen).toLocaleString()
                    : "Never"}
                </TableCell>
                <TableCell className="py-3 px-4">
                  <div className="flex items-center">
                    <div
                      className={`h-2 w-2 rounded-full mr-2 ${
                        client.status === "online"
                          ? "bg-[#05ffa1]"
                          : "bg-gray-500"
                      }`}
                    ></div>
                    <span
                      className={`${
                        client.status === "online"
                          ? "text-[#05ffa1]"
                          : "text-gray-400"
                      }`}
                    >
                      {client.status || "Unknown"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right py-3 px-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-[#00E5CC] hover:text-[#00E5CC]/80"
                      onClick={() => handleEditClick(client)}
                      disabled={unpairingId === (client.wolf_client_id || client.id)}
                      title="Edit Client Settings"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit Client Settings</span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-[#0077B6] hover:text-[#0077B6]/80"
                      onClick={() => {
                        // Use wolf_client_id if available, fallback to database id
                        onUnpair(client.wolf_client_id || client.id);
                      }}
                      disabled={unpairingId === (client.wolf_client_id || client.id)}
                      title="Unpair Client"
                    >
                      {unpairingId === (client.wolf_client_id || client.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span className="sr-only">
                        {unpairingId === (client.wolf_client_id || client.id) ? "Unpairing..." : "Unpair"}
                      </span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {pairedClients.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-gray-400 py-3 px-4"
                >
                  No paired clients
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      
      {/* Edit Client Settings Dialog */}
      {editingClient && (
        <EditClientSettingsDialog
          isOpen={editDialogOpen}
          onClose={handleEditDialogClose}
          client={editingClient}
          onSuccess={handleEditSuccess}
        />
      )}
    </Card>
  );
};

export default PairedClientsCard;

"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, Laptop, X } from "lucide-react";
import { useState } from "react";
import PinInput from "./components/pin-input";

// Sample pending client data
const PENDING_CLIENTS = [
  {
    id: 1,
    ip: "192.168.1.45",
    device: "Windows PC",
    requestTime: "2 minutes ago",
    pairSecret: "WOLF-1234-ABCD",
    received: "2023-04-19 14:32:45",
  },
  {
    id: 2,
    ip: "192.168.1.67",
    device: "MacBook Pro",
    requestTime: "5 minutes ago",
    pairSecret: "WOLF-5678-EFGH",
    received: "2023-04-19 14:29:12",
  },
  {
    id: 3,
    ip: "192.168.1.102",
    device: "Android TV",
    requestTime: "15 minutes ago",
    pairSecret: "WOLF-9012-IJKL",
    received: "2023-04-19 14:19:37",
  },
];

export default function ClientsPage() {
  const [clientName, setClientName] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pairedClients, setPairedClients] = useState([
    {
      id: 101,
      name: "Living Room TV",
      ip: "192.168.1.55",
      device: "Samsung TV",
      lastConnected: "2 hours ago",
    },
    {
      id: 102,
      name: "Gaming PC",
      ip: "192.168.1.22",
      device: "Windows PC",
      lastConnected: "Yesterday",
    },
  ]);

  const handlePairClient = () => {
    if (!selectedClient || !clientName.trim() || pinCode.length !== 4) return;

    const clientToPair = PENDING_CLIENTS.find(
      (client) => client.id === selectedClient
    );
    if (!clientToPair) return;

    const newPairedClient = {
      id: Date.now(),
      name: clientName,
      ip: clientToPair.ip,
      device: clientToPair.device,
      lastConnected: "Just now",
    };

    setPairedClients([...pairedClients, newPairedClient]);
    setClientName("");
    setPinCode("");
    setSelectedClient(null);
  };

  const startPairing = (clientId: number) => {
    setSelectedClient(clientId);
    setClientName("");
    setPinCode("");
  };

  const cancelPairing = () => {
    setSelectedClient(null);
    setClientName("");
    setPinCode("");
  };

  // Get the selected client details
  const selectedClientDetails = selectedClient
    ? PENDING_CLIENTS.find((client) => client.id === selectedClient)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white neon-text">
        Client Pairing
      </h1>

      <div className="relative">
        {/* Main layout container that changes based on pairing state */}
        <div
          className={`grid gap-6 transition-all duration-500 ease-in-out ${
            selectedClient ? "md:grid-cols-2" : "grid-cols-1"
          }`}
        >
          {/* Pending Requests Card - Always visible */}
          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle className="text-white">Pending Requests</CardTitle>
              <CardDescription className="text-gray-400">
                Clients waiting to be paired with your server
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-[rgba(255,255,255,0.1)]">
                    <TableHead className="text-[#fffb96]">IP Address</TableHead>
                    <TableHead className="text-[#fffb96]">Device</TableHead>
                    <TableHead className="text-[#fffb96]">Requested</TableHead>
                    <TableHead className="text-[#fffb96] text-right">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PENDING_CLIENTS.map((client) => (
                    <TableRow
                      key={client.id}
                      className="border-[rgba(255,255,255,0.1)]"
                    >
                      <TableCell className="text-white">{client.ip}</TableCell>
                      <TableCell className="text-white">
                        {client.device}
                      </TableCell>
                      <TableCell className="text-gray-400">
                        {client.requestTime}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white"
                          onClick={() => startPairing(client.id)}
                        >
                          Pair
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {PENDING_CLIENTS.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-gray-400"
                      >
                        No pending requests
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Complete Pairing Card - Slides in when needed */}
          <div
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              selectedClient
                ? "opacity-100 max-h-[1000px]"
                : "opacity-0 max-h-0 md:absolute md:right-0 md:top-0 md:w-1/2"
            }`}
          >
            <Card className="glass-card border-none h-full">
              <CardHeader>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-2 text-gray-400 hover:text-white"
                    onClick={cancelPairing}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <CardTitle className="text-white">
                      Complete Pairing
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Enter the pairing code shown on the client device
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedClientDetails && (
                    <div className="rounded-md bg-[rgba(0,0,0,0.3)] p-3 text-sm mb-4">
                      <p className="mb-1">
                        <span className="text-gray-400">IP Address:</span>{" "}
                        <span className="text-white">
                          {selectedClientDetails.ip}
                        </span>
                      </p>
                      <p className="mb-1">
                        <span className="text-gray-400">Pair Secret:</span>{" "}
                        <span className="text-white">
                          {selectedClientDetails.pairSecret}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-400">Received:</span>{" "}
                        <span className="text-white">
                          {selectedClientDetails.received}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="client-name" className="text-[#fffb96]">
                      Client Name
                    </Label>
                    <Input
                      id="client-name"
                      placeholder="e.g. Living Room TV"
                      className="bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="pin-code" className="text-[#fffb96]">
                      Pairing Code
                    </Label>
                    <div className="flex flex-col items-center">
                      <PinInput
                        value={pinCode}
                        onChange={setPinCode}
                        maxLength={4}
                      />
                      <p className="text-xs text-gray-400 mt-2">
                        Enter the 4-digit code displayed on the client device
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <Button
                      variant="outline"
                      className="flex-1 border-[rgba(255,255,255,0.1)] text-gray-400 hover:text-white hover:bg-[rgba(255,255,255,0.05)]"
                      onClick={cancelPairing}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white"
                      onClick={handlePairClient}
                      disabled={!clientName.trim() || pinCode.length !== 4}
                    >
                      Confirm Pairing
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-white">Paired Clients</CardTitle>
          <CardDescription className="text-gray-400">
            Devices connected to your streaming server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[rgba(255,255,255,0.1)]">
                <TableHead className="text-[#fffb96]">Name</TableHead>
                <TableHead className="text-[#fffb96]">IP Address</TableHead>
                <TableHead className="text-[#fffb96]">Device</TableHead>
                <TableHead className="text-[#fffb96]">Last Connected</TableHead>
                <TableHead className="text-[#fffb96]">Status</TableHead>
                <TableHead className="text-[#fffb96] text-right">
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
                  <TableCell className="font-medium text-white">
                    {client.name}
                  </TableCell>
                  <TableCell className="text-white">{client.ip}</TableCell>
                  <TableCell className="text-white">{client.device}</TableCell>
                  <TableCell className="text-gray-400">
                    {client.lastConnected}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-[#05ffa1] mr-2"></div>
                      <span className="text-[#05ffa1]">Online</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-gray-400 hover:text-white"
                      >
                        <Laptop className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[#0077B6] hover:text-[#0077B6]/80"
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {pairedClients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-gray-400"
                  >
                    No paired clients
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

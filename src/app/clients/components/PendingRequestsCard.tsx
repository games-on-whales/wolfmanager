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
import { type PendingPairRequest } from "@/lib/api/wolf-pair";
import { RefreshCw } from "lucide-react";
import React from "react";
import { formatDateTimeUTC } from "./date-format";

interface PendingRequestsCardProps {
  requests: PendingPairRequest[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSelectRequest: (request: PendingPairRequest) => void;
}

const PendingRequestsCard: React.FC<PendingRequestsCardProps> = ({
  requests,
  isLoading,
  isRefreshing,
  onRefresh,
  onSelectRequest,
}) => {
  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-white">Pending Requests</CardTitle>
            <CardDescription className="text-gray-400">
              Clients waiting to be paired with your server
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <Table className="border-separate border-spacing-0">
          <TableHeader>
            <TableRow className="border-[rgba(255,255,255,0.1)]">
              <TableHead className="text-[#fffb96] py-3 px-4">
                Device Type
              </TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4">
                Pair Secret
              </TableHead>
              <TableHead className="text-[#fffb96] py-3 px-4">
                Received
              </TableHead>
              <TableHead className="text-[#fffb96] text-right py-3 px-4">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((request) => (
              <TableRow
                key={request.id}
                className="border-[rgba(255,255,255,0.1)]"
              >
                <TableCell className="text-white py-3 px-4">
                  {request.deviceType}
                </TableCell>
                <TableCell className="text-white py-3 px-4">
                  {request.pair_secret}
                </TableCell>
                <TableCell className="text-gray-400 py-3 px-4">
                  {formatDateTimeUTC(request.timestamp)}
                </TableCell>
                <TableCell className="text-right py-3 px-4">
                  <Button
                    size="sm"
                    className="bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-white"
                    onClick={() => onSelectRequest(request)}
                  >
                    Pair
                  </Button>
                </TableCell>
              </TableRow>
            ))}

            {requests.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-gray-400 py-3 px-4"
                >
                  No pending requests
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default PendingRequestsCard;

"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { ModeratedDealer } from "@/actions/dealers/get-all-dealers";
import { setDealerStatus } from "@/actions/dealers/set-dealer-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/config/routes";
import { DealerStatusEnum as DealerStatus } from "@/enums/dealer-status";

/**
 * Moderation table for marketplace dealers.
 *
 * @param dealers - All dealers including suspended ones
 */
export function DealerModerationList({
  dealers,
}: {
  dealers: ModeratedDealer[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? dealers.filter((d) =>
        [d.name, d.slug, d.city, d.owner?.email, d.owner?.name]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
      )
    : dealers;

  const toggleStatus = async (dealer: ModeratedDealer) => {
    const next =
      dealer.status === DealerStatus.ACTIVE
        ? DealerStatus.SUSPENDED
        : DealerStatus.ACTIVE;
    setPendingId(dealer.id);
    try {
      const result = await setDealerStatus(dealer.id, next);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        next === DealerStatus.ACTIVE
          ? `${dealer.name} re-activated`
          : `${dealer.name} suspended`,
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search dealers, cities or owner email"
        className="max-w-sm"
      />
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No dealers found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Cars</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((dealer) => {
                  const isActive = dealer.status === DealerStatus.ACTIVE;
                  return (
                    <TableRow key={dealer.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={ROUTES.DEALER_PROFILE(dealer.slug)}
                          target="_blank"
                          className="flex items-center gap-1 hover:text-blue-600"
                        >
                          {dealer.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {dealer.owner?.name || "—"}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {dealer.owner?.email}
                        </div>
                      </TableCell>
                      <TableCell>{dealer.city || "—"}</TableCell>
                      <TableCell>{dealer.carCount}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }
                        >
                          {dealer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={isActive ? "destructive" : "outline"}
                          disabled={pendingId === dealer.id}
                          onClick={() => toggleStatus(dealer)}
                        >
                          {pendingId === dealer.id && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          {isActive ? "Suspend" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

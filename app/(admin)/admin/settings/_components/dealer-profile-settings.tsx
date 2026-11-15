"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getMyDealer, type MyDealer } from "@/actions/dealers/get-my-dealer";
import { DealerProfileForm } from "@/components/dealer/dealer-profile-form";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/config/routes";

/**
 * Settings tab for the signed-in dealer's public profile.
 */
export const DealerProfileSettings = () => {
  const [dealer, setDealer] = useState<MyDealer | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getMyDealer();
    if (result.success) {
      setDealer(result.data);
      setError(null);
    } else {
      setDealer(null);
      setError(result.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dealer Profile</CardTitle>
        <CardDescription>
          This is what buyers see on your public dealer page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dealer === undefined && <Skeleton className="h-64 w-full" />}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {dealer === null && !error && (
          <div className="space-y-3 text-gray-600">
            <p>You don&apos;t have a dealer profile yet.</p>
            <Link href={ROUTES.BECOME_DEALER} className={buttonVariants()}>
              Create dealer profile
            </Link>
          </div>
        )}
        {dealer && <DealerProfileForm dealer={dealer} onSaved={load} />}
      </CardContent>
    </Card>
  );
};

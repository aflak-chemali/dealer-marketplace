"use server";

import { getLogger } from "@/lib/logger";
import { ensureAdminUser } from "@/lib/supabase/ensure-admin-user";
import type { ActionResponse } from "@/types/common/action-response";
import type { Dealer } from "@/types/dealer/dealer";

const log = getLogger(["app", "actions", "dealers"]);

/**
 * Dealer row for the moderation table.
 */
export type ModeratedDealer = Dealer & {
  carCount: number;
  owner: { name: string | null; email: string } | null;
};

/**
 * Lists every dealer (including suspended) for platform moderation.
 * Requires a platform admin.
 */
export async function getAllDealers(): Promise<
  ActionResponse<ModeratedDealer[]>
> {
  try {
    const { supabase } = await ensureAdminUser();

    const { data, error } = await supabase
      .from("Dealer")
      .select("*, cars:Car(count), owner:User(name, email)")
      .order("createdAt", { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: (data || []).map((dealer) => ({
        ...dealer,
        carCount: dealer.cars?.[0]?.count ?? 0,
        owner: dealer.owner ?? null,
      })),
    };
  } catch (error) {
    log.error("Error fetching dealers for moderation: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/routes";
import { DealerStatusEnum as DealerStatus } from "@/enums/dealer-status";
import { getLogger } from "@/lib/logger";
import { ensureAdminUser } from "@/lib/supabase/ensure-admin-user";
import type { ActionResponse } from "@/types/common/action-response";

const log = getLogger(["app", "actions", "dealers"]);

/**
 * Suspends or re-activates a dealer. Suspended dealers and their listings are
 * hidden from the public marketplace and the dealer loses portal access.
 * Requires a platform admin.
 *
 * @param dealerId - Dealer to moderate
 * @param status - New moderation status
 */
export async function setDealerStatus(
  dealerId: string,
  status: DealerStatus,
): Promise<ActionResponse<null>> {
  try {
    if (!Object.values(DealerStatus).includes(status)) {
      return { success: false, error: "Invalid status" };
    }

    const { supabase } = await ensureAdminUser();

    const { error } = await supabase
      .from("Dealer")
      .update({ status })
      .eq("id", dealerId);

    if (error) throw error;

    log.info("Dealer status changed (dealerId: {dealerId}, status: {status})", {
      dealerId,
      status,
    });

    revalidatePath(ROUTES.ADMIN.ADMIN_DEALERS);
    revalidatePath(ROUTES.DEALERS);
    revalidatePath(ROUTES.HOME.CARS);

    return { success: true, data: null };
  } catch (error) {
    log.error("Error changing dealer status: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import {
  dealerWriteErrorMessage,
  toDealerRow,
} from "@/actions/dealers/to-dealer-row";
import { ROUTES } from "@/config/routes";
import { getLogger } from "@/lib/logger";
import { ensureDealerUser } from "@/lib/supabase/ensure-dealer-user";
import {
  type DealerProfileFormData,
  dealerProfileSchema,
} from "@/schemas/dealer/dealer-profile.schema";
import type { ActionResponse } from "@/types/common/action-response";

const log = getLogger(["app", "actions", "dealers"]);

/**
 * Updates the signed-in dealer's public profile.
 *
 * @param input - Dealer profile details
 * @returns The (possibly new) slug or an error
 */
export async function updateMyDealer(
  input: DealerProfileFormData,
): Promise<ActionResponse<{ slug: string }>> {
  try {
    const parsed = dealerProfileSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid dealer profile",
      };
    }

    const { supabase, dealerId } = await ensureDealerUser({
      requireDealer: true,
    });

    const { data: dealer, error } = await supabase
      .from("Dealer")
      .update(toDealerRow(parsed.data))
      .eq("id", dealerId)
      .select("slug")
      .single();

    if (error) {
      return { success: false, error: dealerWriteErrorMessage(error) };
    }

    log.info("Dealer profile updated (dealerId: {dealerId})", { dealerId });

    revalidatePath(ROUTES.DEALERS);
    revalidatePath(ROUTES.DEALER_PROFILE(dealer.slug));

    return { success: true, data: { slug: dealer.slug } };
  } catch (error) {
    log.error("Error updating dealer profile: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

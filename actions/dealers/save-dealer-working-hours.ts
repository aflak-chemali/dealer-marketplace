"use server";

import { revalidatePath } from "next/cache";
import { getLogger } from "@/lib/logger";
import { ensureDealerUser } from "@/lib/supabase/ensure-dealer-user";
import type { ActionResponse } from "@/types/common/action-response";
import type { WorkingHourInput } from "@/types/dealership/working-hour-input";

const log = getLogger(["app", "actions", "dealers"]);

/**
 * Replaces the signed-in dealer's weekly working hours.
 *
 * @param workingHours - One entry per day of week
 * @returns Success message or error
 */
export async function saveDealerWorkingHours(
  workingHours: WorkingHourInput[],
): Promise<ActionResponse<string>> {
  try {
    const { supabase, dealerId } = await ensureDealerUser({
      requireDealer: true,
    });

    const { error: deleteError } = await supabase
      .from("WorkingHour")
      .delete()
      .eq("dealerId", dealerId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from("WorkingHour").insert(
      workingHours.map((hour) => ({
        dealerId,
        dayOfWeek: hour.dayOfWeek,
        openTime: hour.openTime,
        closeTime: hour.closeTime,
        isOpen: hour.isOpen,
      })),
    );
    if (insertError) throw insertError;

    log.info("Dealer working hours saved (dealerId: {dealerId})", {
      dealerId,
    });

    revalidatePath("/", "layout");

    return { success: true, data: "Working hours saved successfully" };
  } catch (error) {
    log.error("Error saving dealer working hours: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

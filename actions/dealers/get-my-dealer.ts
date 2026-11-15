"use server";

import { getLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/supabase";
import type { ActionResponse } from "@/types/common/action-response";
import type { Dealer } from "@/types/dealer/dealer";
import type { SerializedWorkingHour } from "@/types/dealership/serialized-working-hour";

const log = getLogger(["app", "actions", "dealers"]);

/**
 * Dealer profile of the signed-in user with weekly working hours.
 */
export type MyDealer = Dealer & { workingHours: SerializedWorkingHour[] };

/**
 * Returns the signed-in user's dealer profile, or null when they have none.
 */
export async function getMyDealer(): Promise<ActionResponse<MyDealer | null>> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) throw new Error("Unauthorized");

    const { data: user } = await supabase
      .from("User")
      .select("id")
      .eq("supabaseAuthUserId", authUser.id)
      .single();
    if (!user) throw new Error("User not found");

    const { data: dealer, error } = await supabase
      .from("Dealer")
      .select("*, workingHours:WorkingHour(*)")
      .eq("ownerId", user.id)
      .maybeSingle();

    if (error) throw error;

    return {
      success: true,
      data: dealer
        ? { ...dealer, workingHours: dealer.workingHours ?? [] }
        : null,
    };
  } catch (error) {
    log.error("Error fetching own dealer profile: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

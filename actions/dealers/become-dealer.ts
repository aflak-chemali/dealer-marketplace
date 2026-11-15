"use server";

import { revalidatePath } from "next/cache";
import {
  dealerWriteErrorMessage,
  toDealerRow,
} from "@/actions/dealers/to-dealer-row";
import { ROUTES } from "@/config/routes";
import { getLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/supabase";
import {
  type DealerProfileFormData,
  dealerProfileSchema,
} from "@/schemas/dealer/dealer-profile.schema";
import type { ActionResponse } from "@/types/common/action-response";

const log = getLogger(["app", "actions", "dealers"]);

/**
 * Creates a dealer profile for the signed-in user.
 * A database trigger promotes the user's role from USER to DEALER.
 *
 * @param input - Dealer profile details
 * @returns The new dealer slug or an error
 */
export async function becomeDealer(
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

    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authUser) throw new Error("Unauthorized");

    const { data: user } = await supabase
      .from("User")
      .select("id")
      .eq("supabaseAuthUserId", authUser.id)
      .single();
    if (!user) throw new Error("User not found");

    const { data: existing } = await supabase
      .from("Dealer")
      .select("id")
      .eq("ownerId", user.id)
      .maybeSingle();
    if (existing) {
      return { success: false, error: "You already have a dealer profile." };
    }

    const { data: dealer, error } = await supabase
      .from("Dealer")
      .insert({ ...toDealerRow(parsed.data), ownerId: user.id })
      .select("slug")
      .single();

    if (error) {
      return { success: false, error: dealerWriteErrorMessage(error) };
    }

    log.info("Dealer profile created (slug: {slug})", { slug: dealer.slug });

    revalidatePath(ROUTES.DEALERS);
    revalidatePath(ROUTES.HOME.HOME, "layout");

    return { success: true, data: { slug: dealer.slug } };
  } catch (error) {
    log.error("Error creating dealer profile: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

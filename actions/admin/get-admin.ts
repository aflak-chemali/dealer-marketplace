"use server";

import { DealerStatusEnum as DealerStatus } from "@/enums/dealer-status";
import { UserRoleEnum as UserRole } from "@/enums/user-role";
import { createClient } from "@/lib/supabase/supabase";
import type { AdminAuthResult } from "@/types/common/admin-auth-result";

/**
 * Verifies dealer-portal access (platform admins or active dealers).
 * Called by admin layout to enforce role-based access.
 *
 * @returns Authorization result with user data if admin, or reason if denied
 * @see ROUTES.ADMIN.ADMIN - Protected admin routes
 */
export async function getAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) throw new Error("Unauthorized");

  const { data: user } = await supabase
    .from("User")
    .select("*")
    .eq("supabaseAuthUserId", authUser.id)
    .single();

  if (user?.role === UserRole.ADMIN) {
    return { authorized: true, user };
  }

  // Dealers may use the portal while their dealer profile is active
  if (user?.role === UserRole.DEALER) {
    const { data: dealer } = await supabase
      .from("Dealer")
      .select("id, status")
      .eq("ownerId", user.id)
      .maybeSingle();

    if (dealer?.status === DealerStatus.ACTIVE) {
      return { authorized: true, user };
    }
  }

  // If user not found in our db or not an admin/active dealer, return not authorized
  return { authorized: false, reason: "not-admin" };
}

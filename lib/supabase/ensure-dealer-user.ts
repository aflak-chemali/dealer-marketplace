import { DealerStatusEnum as DealerStatus } from "@/enums/dealer-status";
import { UserRoleEnum as UserRole } from "@/enums/user-role";
import { createClient } from "@/lib/supabase/supabase";

export interface DealerUserContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  /** App `User.id` of the caller. */
  userId: string;
  role: UserRole;
  /** Active dealer owned by the caller, or null for superadmins without one. */
  dealerId: string | null;
  /** True for platform administrators (moderators). */
  isSuperAdmin: boolean;
}

/**
 * Ensures the caller can use the dealer portal: either a platform admin
 * (superadmin) or the owner of an ACTIVE dealer profile.
 *
 * Superadmins are not scoped to a dealer unless `requireDealer` is set, in which
 * case their own dealer profile is looked up (needed when creating listings).
 *
 * @throws {Error} "Unauthorized" when not signed in, "Unauthorized access" when
 * the caller is neither an admin nor an active dealer.
 */
export async function ensureDealerUser(
  options: { requireDealer?: boolean } = {},
): Promise<DealerUserContext> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw new Error("Unauthorized");
  }

  const { data: user } = await supabase
    .from("User")
    .select("id, role")
    .eq("supabaseAuthUserId", authUser.id)
    .single();

  if (!user) {
    throw new Error("Unauthorized access");
  }

  const isSuperAdmin = user.role === UserRole.ADMIN;

  if (!isSuperAdmin && user.role !== UserRole.DEALER) {
    throw new Error("Unauthorized access");
  }

  if (isSuperAdmin && !options.requireDealer) {
    return {
      supabase,
      userId: user.id,
      role: user.role as UserRole,
      dealerId: null,
      isSuperAdmin,
    };
  }

  const { data: dealer } = await supabase
    .from("Dealer")
    .select("id, status")
    .eq("ownerId", user.id)
    .maybeSingle();

  if (!dealer || dealer.status !== DealerStatus.ACTIVE) {
    if (isSuperAdmin) {
      throw new Error(
        "Create a dealer profile before listing cars (Become a dealer).",
      );
    }
    throw new Error("Unauthorized access");
  }

  return {
    supabase,
    userId: user.id,
    role: user.role as UserRole,
    dealerId: dealer.id as string,
    isSuperAdmin,
  };
}

/**
 * Storage folder for a car's images. New listings live under the dealer's
 * folder so storage RLS can scope writes; legacy listings use `cars/{id}`.
 */
export function carStorageFolder(
  carId: string,
  dealerId: string | null | undefined,
): string {
  return dealerId ? `dealers/${dealerId}/cars/${carId}` : `cars/${carId}`;
}

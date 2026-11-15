"use server";

import { revalidatePath } from "next/cache";
import { checkStorageQuota } from "@/actions/storage/check-storage-quota";
import { env } from "@/config/env";
import { ROUTES } from "@/config/routes";
import { getLogger } from "@/lib/logger";
import { ensureDealerUser } from "@/lib/supabase/ensure-dealer-user";
import { createAdminClient } from "@/lib/supabase/supabase";
import type { ActionResponse } from "@/types/common/action-response";

const log = getLogger(["app", "actions", "dealers"]);

const BUCKET = "dealer-assets";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type DealerImageKind = "logo" | "cover";

const COLUMN: Record<DealerImageKind, "logoUrl" | "coverImageUrl"> = {
  logo: "logoUrl",
  cover: "coverImageUrl",
};

/**
 * Uploads (or replaces) the signed-in dealer's logo or cover image.
 * Files are stored under `dealer-assets/{dealerId}/` and the previous image of
 * the same kind is removed to save free-tier storage.
 *
 * @param formData - `kind` ("logo" | "cover") and `file`
 * @returns Public URL of the new image
 */
export async function uploadDealerImage(
  formData: FormData,
): Promise<ActionResponse<{ url: string }>> {
  try {
    const kind = formData.get("kind") as DealerImageKind;
    const file = formData.get("file");

    if (kind !== "logo" && kind !== "cover") {
      return { success: false, error: "Invalid image type" };
    }
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Please choose an image" };
    }
    const extension = ALLOWED_TYPES[file.type];
    if (!extension) {
      return { success: false, error: "Use a JPEG, PNG or WebP image" };
    }
    if (file.size > MAX_BYTES) {
      return { success: false, error: "Image must be smaller than 2MB" };
    }

    const { supabase, dealerId } = await ensureDealerUser({
      requireDealer: true,
    });

    const { allowed } = await checkStorageQuota(file.size);
    if (!allowed) {
      return {
        success: false,
        error: "Global storage limit reached. Please contact support.",
      };
    }

    const supabaseAdmin = createAdminClient();
    const storage = supabaseAdmin.storage.from(BUCKET);
    const path = `${dealerId}/${kind}-${Date.now()}.${extension}`;

    const { error: uploadError } = await storage.upload(
      path,
      Buffer.from(await file.arrayBuffer()),
      { contentType: file.type, cacheControl: "86400", upsert: false },
    );
    if (uploadError) throw new Error(uploadError.message);

    // Remove older images of the same kind and recompute the dealer's usage
    const { data: files } = await storage.list(`${dealerId}`);
    const newName = path.split("/").pop();
    const stale = (files || []).filter(
      (f) => f.name.startsWith(`${kind}-`) && f.name !== newName,
    );
    if (stale.length > 0) {
      await storage.remove(stale.map((f) => `${dealerId}/${f.name}`));
    }
    const assetsSizeBytes = (files || [])
      .filter((f) => !stale.includes(f))
      .reduce((acc, f) => acc + (f.metadata?.size || 0), 0);

    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

    const { data: dealer, error: updateError } = await supabase
      .from("Dealer")
      .update({ [COLUMN[kind]]: url, assetsSizeBytes })
      .eq("id", dealerId)
      .select("slug")
      .single();
    if (updateError) throw updateError;

    revalidatePath(ROUTES.DEALERS);
    if (dealer?.slug) revalidatePath(ROUTES.DEALER_PROFILE(dealer.slug));

    return { success: true, data: { url } };
  } catch (error) {
    log.error("Error uploading dealer image: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

"use server";

import { sanitizeSearchTerm } from "@/actions/dealers/sanitize-search";
import { CarStatusEnum as CarStatus } from "@/enums/car-status";
import { DealerStatusEnum as DealerStatus } from "@/enums/dealer-status";
import { getLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/supabase";
import type { ActionResponse } from "@/types/common/action-response";
import type { DealerFeedItem } from "@/types/dealer/dealer-feed-item";

const log = getLogger(["app", "actions", "dealers"]);

const MAX_DEALERS = 60;

/**
 * Public dealer feed. Lists active dealers with their available car count,
 * optionally filtered by a search term matching dealer name or city.
 *
 * @param search - Free-text search for dealer name or city
 * @returns Active dealers sorted by name
 */
export async function getDealers({
  search = "",
}: {
  search?: string;
} = {}): Promise<ActionResponse<DealerFeedItem[]>> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("Dealer")
      .select(
        "id, name, slug, city, logoUrl, coverImageUrl, bio, cars:Car(count)",
      )
      .eq("status", DealerStatus.ACTIVE)
      .eq("cars.status", CarStatus.AVAILABLE)
      .order("name", { ascending: true })
      .limit(MAX_DEALERS);

    const term = sanitizeSearchTerm(search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const dealers: DealerFeedItem[] = (data || []).map((dealer) => ({
      id: dealer.id,
      name: dealer.name,
      slug: dealer.slug,
      city: dealer.city,
      logoUrl: dealer.logoUrl,
      coverImageUrl: dealer.coverImageUrl,
      bio: dealer.bio,
      carCount: dealer.cars?.[0]?.count ?? 0,
    }));

    return { success: true, data: dealers };
  } catch (error) {
    log.error("Error fetching dealers: {error}", {
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

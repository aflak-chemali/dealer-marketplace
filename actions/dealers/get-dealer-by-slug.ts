"use server";

import { CarStatusEnum as CarStatus } from "@/enums/car-status";
import { DealerStatusEnum as DealerStatus } from "@/enums/dealer-status";
import { serializeCarData } from "@/lib/helpers/serialize-car";
import { getLogger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/supabase";
import type { SerializedCar } from "@/types/car/serialized-car";
import type { ActionResponse } from "@/types/common/action-response";
import type { Dealer } from "@/types/dealer/dealer";
import type { SerializedWorkingHour } from "@/types/dealership/serialized-working-hour";

const log = getLogger(["app", "actions", "dealers"]);

/**
 * Public dealer profile with working hours and available cars.
 */
export type DealerProfile = Dealer & {
  workingHours: SerializedWorkingHour[];
  cars: SerializedCar[];
};

/**
 * Loads an active dealer's public profile by slug.
 *
 * @param slug - Dealer profile slug
 * @returns Dealer profile, or null data when not found / not active
 */
export async function getDealerBySlug(
  slug: string,
): Promise<ActionResponse<DealerProfile | null>> {
  try {
    const supabase = await createClient();

    const { data: dealer, error } = await supabase
      .from("Dealer")
      .select("*, workingHours:WorkingHour(*)")
      .eq("slug", slug)
      .eq("status", DealerStatus.ACTIVE)
      .maybeSingle();

    if (error) throw error;
    if (!dealer) return { success: true, data: null };

    const { data: cars, error: carsError } = await supabase
      .from("Car")
      .select(
        `
        *,
        carMake:CarMake(id, name, slug),
        carColor:CarColor(id, name, slug)
      `,
      )
      .eq("dealerId", dealer.id)
      .eq("status", CarStatus.AVAILABLE)
      .order("createdAt", { ascending: false });

    if (carsError) throw carsError;

    const summary = {
      id: dealer.id,
      name: dealer.name,
      slug: dealer.slug,
      city: dealer.city,
      logoUrl: dealer.logoUrl,
    };

    return {
      success: true,
      data: {
        ...dealer,
        workingHours: dealer.workingHours ?? [],
        cars: (cars || []).map((car) => ({
          ...serializeCarData(car),
          dealer: summary,
        })),
      },
    };
  } catch (error) {
    log.error("Error fetching dealer (slug: {slug}): {error}", {
      slug,
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

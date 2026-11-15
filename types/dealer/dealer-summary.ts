import type { Dealer } from "@/types/dealer/dealer";

/**
 * Minimal dealer info embedded in car listings (cards, detail pages).
 */
export type DealerSummary = Pick<
  Dealer,
  "id" | "name" | "slug" | "city" | "logoUrl"
>;

import type { Dealer } from "@/types/dealer/dealer";

/**
 * Dealer card data for the public `/dealers` feed.
 */
export type DealerFeedItem = Pick<
  Dealer,
  "id" | "name" | "slug" | "city" | "logoUrl" | "coverImageUrl" | "bio"
> & {
  /** Number of available listings. */
  carCount: number;
};

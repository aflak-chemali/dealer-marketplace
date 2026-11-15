import type { DealerStatusEnum } from "@/enums/dealer-status";

/**
 * Dealer profile row. Each dealer is owned by exactly one user and lists its
 * own cars on the marketplace.
 */
export interface Dealer {
  /** Unique database identifier. */
  id: string;
  /** App `User.id` of the owner. */
  ownerId: string;
  /** Display name. */
  name: string;
  /** URL-safe unique slug used for `/dealers/[slug]`. */
  slug: string;
  /** Public logo URL. */
  logoUrl: string | null;
  /** Public cover/banner image URL. */
  coverImageUrl: string | null;
  /** About text shown on the profile. */
  bio: string | null;
  /** Contact phone number. */
  phone: string | null;
  /** Contact email address. */
  email: string | null;
  /** WhatsApp number (international format). */
  whatsappPhone: string | null;
  /** Street address. */
  address: string | null;
  /** City used for search and display. */
  city: string | null;
  /** Moderation status. */
  status: DealerStatusEnum;
  /** Creation timestamp. */
  createdAt: string;
  /** Last update timestamp. */
  updatedAt: string;
}

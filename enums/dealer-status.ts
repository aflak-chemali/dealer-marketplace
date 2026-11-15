/**
 * Moderation status of a dealer profile.
 */
export enum DealerStatusEnum {
  /** Visible in the public feed; can manage inventory. */
  ACTIVE = "ACTIVE",
  /** Hidden from the public and blocked from managing inventory. */
  SUSPENDED = "SUSPENDED",
}

export type DealerStatus = DealerStatusEnum;

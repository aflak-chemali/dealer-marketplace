/**
 * User roles in the system
 */
export enum UserRoleEnum {
  /** Account administrator with elevated permissions. */
  ADMIN = "ADMIN",
  /** Dealer who owns a dealer profile and manages their own inventory. */
  DEALER = "DEALER",
  /** Standard account user. */
  USER = "USER",
}

export type UserRole = UserRoleEnum;

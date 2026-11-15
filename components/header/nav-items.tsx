import {
  Calendar,
  Car,
  CarFront,
  Cog,
  Heart,
  Home,
  Layout,
  LayoutDashboard,
  type LucideIcon,
  ShieldCheck,
  Store,
} from "lucide-react";
import { ROUTES } from "@/config/routes";

/**
 * Navigation item used by desktop and mobile navigation components.
 * Optional auth and admin flags control which items are rendered.
 */
export interface NavItem {
  /** Display text for the navigation item. */
  label: string;
  /** Lucide icon component for visual representation. */
  icon: LucideIcon;
  /** Route path for navigation. */
  href: string;
  /** Whether to show this item in mobile bottom navigation. */
  showInMobile?: boolean;
  /** Whether this item requires user authentication. */
  requiresAuth?: boolean;
  /** Whether to hide this item for admin users. */
  hideForAdmin?: boolean;
  /** Whether this item is only shown to platform admins (superadmins). */
  superAdminOnly?: boolean;
}

// "Become a dealer" call to action for signed-in regular users
export const BECOME_DEALER_ITEM: NavItem = {
  label: "Sell your cars",
  icon: Store,
  href: ROUTES.BECOME_DEALER,
  requiresAuth: true,
};

/**
 * Navigation configuration file containing all navigation items for the application.
 * Centralizes navigation data to ensure consistency across desktop and mobile navigation.
 * Defines main site navigation, admin portal navigation, and special admin portal button.
 *
 * @see ROUTES - Centralized route constants
 */

// Main site navigation
export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    icon: Home,
    href: ROUTES.HOME.HOME,
    showInMobile: true,
  },
  {
    label: "All Cars",
    icon: CarFront,
    href: ROUTES.HOME.CARS,
    showInMobile: true,
  },
  {
    label: "Dealers",
    icon: Store,
    href: ROUTES.DEALERS,
    showInMobile: true,
  },
  {
    label: "Saved",
    icon: Heart,
    href: ROUTES.SAVED_CARS,
    showInMobile: true,
    requiresAuth: true,
  },
  {
    label: "Reservations",
    icon: Calendar,
    href: ROUTES.RESERVATIONS,
    showInMobile: true,
    requiresAuth: true,
    hideForAdmin: true,
  },
];

// Admin portal navigation
export const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: ROUTES.ADMIN.ADMIN,
    showInMobile: true,
  },
  {
    label: "Cars",
    icon: Car,
    href: ROUTES.ADMIN.ADMIN_CARS,
    showInMobile: true,
  },
  {
    label: "Test Drives",
    icon: Calendar,
    href: ROUTES.ADMIN.ADMIN_TEST_DRIVES,
    showInMobile: true,
  },
  {
    label: "Settings",
    icon: Cog,
    href: ROUTES.ADMIN.ADMIN_SETTINGS,
    showInMobile: true,
  },
  {
    label: "Dealers",
    icon: ShieldCheck,
    href: ROUTES.ADMIN.ADMIN_DEALERS,
    showInMobile: true,
    superAdminOnly: true,
  },
];

// Admin / dealer portal button for main site
export const ADMIN_PORTAL_ITEM: NavItem = {
  label: "Admin Portal",
  icon: Layout,
  href: ROUTES.ADMIN.ADMIN,
  requiresAuth: true,
};

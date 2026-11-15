import { isCurrentUserAdmin } from "@/actions/auth/is-current-user-admin";
import { SettingsForm } from "@/app/(admin)/admin/settings/_components/settings-form";

/**
 * Settings page metadata.
 * Describes the portal route for dealer and platform configuration.
 */
export const metadata = {
  title: "Settings",
  description: "Manage your dealer profile, working hours and site settings",
};

export const dynamic = "force-dynamic";

/**
 * Portal settings page.
 * Dealers edit their profile and hours; superadmins also manage platform
 * branding, admin users and home content.
 *
 * @returns Settings page with configuration tabs
 */
export default async function SettingsPage() {
  const isSuperAdmin = await isCurrentUserAdmin();

  return (
    <div>
      <h1 className="mb-6 font-bold text-2xl">Settings</h1>
      <SettingsForm isSuperAdmin={isSuperAdmin} />
    </div>
  );
}

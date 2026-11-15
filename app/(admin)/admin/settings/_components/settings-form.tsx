"use client";

import {
  Building2,
  Clock,
  Home,
  type LucideIcon,
  Shield,
  Store,
} from "lucide-react";
import type { ReactNode } from "react";
import { AdminUsersList } from "@/app/(admin)/admin/settings/_components/admin-users-list";
import { DealerProfileSettings } from "@/app/(admin)/admin/settings/_components/dealer-profile-settings";
import { DealershipInfoForm } from "@/app/(admin)/admin/settings/_components/dealership-info-form";
import { HomeContentForm } from "@/app/(admin)/admin/settings/_components/home-content-form";
import { WorkingHoursForm } from "@/app/(admin)/admin/settings/_components/working-hours-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Props for {@link SettingsForm}.
 */
interface SettingsFormProps {
  /** Whether the viewer is a platform admin (shows platform-wide tabs). */
  isSuperAdmin?: boolean;
}

interface SettingsTab {
  value: string;
  icon: LucideIcon;
  label: [string, string];
  content: ReactNode;
  superAdminOnly?: boolean;
}

const TABS: SettingsTab[] = [
  {
    value: "dealer",
    icon: Store,
    label: ["Dealer", "Profile"],
    content: <DealerProfileSettings />,
  },
  {
    value: "hours",
    icon: Clock,
    label: ["Working", "Hours"],
    content: <WorkingHoursForm />,
  },
  {
    value: "info",
    icon: Building2,
    label: ["Site", "Branding"],
    content: <DealershipInfoForm />,
    superAdminOnly: true,
  },
  {
    value: "admins",
    icon: Shield,
    label: ["Admin", "Users"],
    content: <AdminUsersList />,
    superAdminOnly: true,
  },
  {
    value: "home-data",
    icon: Home,
    label: ["Home", "Data"],
    content: <HomeContentForm />,
    superAdminOnly: true,
  },
];

/**
 * Portal settings with tabs.
 * Dealer Profile / Working Hours: the signed-in dealer's public profile.
 * Site Branding, Admin Users, Home Data: platform-wide, superadmins only.
 *
 * @param isSuperAdmin - Whether to show platform-wide tabs
 * @returns Settings page with configuration tabs
 */
export const SettingsForm = ({ isSuperAdmin = false }: SettingsFormProps) => {
  const tabs = TABS.filter((tab) => isSuperAdmin || !tab.superAdminOnly);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="dealer">
        <TabsList className="h-auto w-full md:h-9 md:w-auto md:self-start">
          {tabs.map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-auto flex-1 py-2 md:flex-none md:py-1"
            >
              <div className="flex flex-col items-center gap-1 md:flex-row md:gap-2">
                <Icon className="h-5 w-5 md:h-4 md:w-4" />
                <span className="text-xs md:hidden">
                  {label[0]}
                  <br />
                  {label[1]}
                </span>
                <span className="hidden md:inline">{label.join(" ")}</span>
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(({ value, content }) => (
          <TabsContent key={value} value={value} className="mt-6 space-y-6">
            {content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

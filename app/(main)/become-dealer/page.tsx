import { Car, Store, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { getMyDealer } from "@/actions/dealers/get-my-dealer";
import { DealerProfileForm } from "@/components/dealer/dealer-profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";

export const metadata = {
  title: "Become a dealer",
  description: "Create your dealer profile and start listing cars for free",
};

const PERKS = [
  { icon: Store, text: "Your own public dealer profile page" },
  { icon: Car, text: "List and manage your inventory" },
  { icon: Users, text: "Receive test-drive bookings from buyers" },
];

export const dynamic = "force-dynamic";

/**
 * Onboarding page where a signed-in user creates their dealer profile.
 * Users who already own a dealer profile are sent to the dealer portal.
 */
export default async function BecomeDealerPage() {
  const existing = await getMyDealer();
  if (existing.success && existing.data) {
    redirect(ROUTES.ADMIN.ADMIN_SETTINGS);
  }

  return (
    <div className="mx-auto max-w-3xl py-12">
      <h1 className="gradient-title mb-2 text-5xl">Become a dealer</h1>
      <p className="mb-6 text-gray-600">
        Create your dealer profile to start listing cars on the marketplace.
      </p>
      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PERKS.map(({ icon: Icon, text }) => (
          <div
            key={text}
            className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-blue-900 text-sm"
          >
            <Icon className="h-5 w-5 shrink-0" />
            {text}
          </div>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <DealerProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}

import { notFound } from "next/navigation";
import { isCurrentUserAdmin } from "@/actions/auth/is-current-user-admin";
import { getAllDealers } from "@/actions/dealers/get-all-dealers";
import { DealerModerationList } from "@/app/(admin)/admin/dealers/_components/dealer-moderation-list";

export const metadata = {
  title: "Dealers",
  description: "Moderate marketplace dealers",
};

export const dynamic = "force-dynamic";

/**
 * Superadmin page listing every dealer with suspend / activate controls.
 * Listings can be removed from the Cars page, which shows all dealers' cars
 * to superadmins.
 */
export default async function AdminDealersPage() {
  if (!(await isCurrentUserAdmin())) {
    notFound();
  }

  const result = await getAllDealers();

  return (
    <div>
      <h1 className="mb-6 font-bold text-2xl">Dealers</h1>
      {result.success ? (
        <DealerModerationList dealers={result.data} />
      ) : (
        <p className="text-red-600">{result.error}</p>
      )}
    </div>
  );
}

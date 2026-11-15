import { Search, Store } from "lucide-react";
import Link from "next/link";
import { getDealers } from "@/actions/dealers/get-dealers";
import { DealerCard } from "@/app/(main)/dealers/_components/dealer-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";

export const metadata = {
  title: "Dealers",
  description: "Browse every dealer on the marketplace and their cars",
};

/**
 * Public feed of all active dealers, searchable by name or city via `?q=`.
 *
 * @param searchParams - Query string containing the optional `q` search term
 */
export default async function DealersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const result = await getDealers({ search: q });
  const dealers = result.success ? result.data : [];

  return (
    <div className="py-12">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="gradient-title mb-2 text-6xl">Dealers</h1>
          <p className="text-gray-600">
            Discover trusted dealers and browse their inventory.
          </p>
        </div>
        <form
          action={ROUTES.DEALERS}
          method="get"
          className="flex w-full gap-2 md:w-96"
        >
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by name or city"
            aria-label="Search dealers"
          />
          <Button type="submit" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {!result.success && (
        <p className="text-red-600">Could not load dealers right now.</p>
      )}

      {result.success && dealers.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Store className="mb-3 h-10 w-10 text-gray-400" />
          <p className="mb-4 text-gray-600">
            {q ? `No dealers match "${q}".` : "No dealers yet."}
          </p>
          {q ? (
            <Link href={ROUTES.DEALERS} className="text-blue-600 underline">
              Clear search
            </Link>
          ) : (
            <Link
              href={ROUTES.BECOME_DEALER}
              className="text-blue-600 underline"
            >
              Be the first dealer
            </Link>
          )}
        </div>
      )}

      {dealers.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dealers.map((dealer) => (
            <DealerCard key={dealer.id} dealer={dealer} />
          ))}
        </div>
      )}
    </div>
  );
}

import { Store } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { ROUTES } from "@/config/routes";

/**
 * 404 page for unknown or suspended dealer profiles.
 */
export default function DealerNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <Store className="h-8 w-8" />
      </div>
      <h1 className="gradient-title mb-2 font-bold text-4xl">
        Dealer Not Found
      </h1>
      <p className="mb-8 max-w-md text-gray-600">
        This dealer does not exist or is no longer active on the marketplace.
      </p>
      <Link href={ROUTES.DEALERS} className={buttonVariants()}>
        Browse Dealers
      </Link>
    </div>
  );
}

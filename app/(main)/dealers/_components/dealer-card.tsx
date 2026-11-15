import { Car, MapPin, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import type { DealerFeedItem } from "@/types/dealer/dealer-feed-item";

/**
 * Card used in the public dealer feed.
 *
 * @param dealer - Dealer feed item to render
 */
export function DealerCard({ dealer }: { dealer: DealerFeedItem }) {
  return (
    <Link href={ROUTES.DEALER_PROFILE(dealer.slug)} className="group block">
      <Card className="h-full overflow-hidden pt-0 transition hover:shadow-lg">
        <div className="relative h-32 bg-gradient-to-r from-blue-600 to-indigo-500">
          {dealer.coverImageUrl && (
            <Image
              src={dealer.coverImageUrl}
              alt={`${dealer.name} cover`}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <CardContent className="relative px-4 pb-4">
          <div className="relative -mt-10 mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow">
            {dealer.logoUrl ? (
              <Image
                src={dealer.logoUrl}
                alt={`${dealer.name} logo`}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <Store className="h-7 w-7 text-gray-400" />
            )}
          </div>
          <h3 className="line-clamp-1 font-bold text-lg group-hover:text-blue-600">
            {dealer.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-600 text-sm">
            {dealer.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {dealer.city}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Car className="h-4 w-4" />
              {dealer.carCount} {dealer.carCount === 1 ? "car" : "cars"}
            </span>
          </div>
          {dealer.bio && (
            <p className="mt-3 line-clamp-2 text-gray-600 text-sm">
              {dealer.bio}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

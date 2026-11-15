import { Clock, Mail, MapPin, MessageCircle, Phone, Store } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getDealerBySlug } from "@/actions/dealers/get-dealer-by-slug";
import { CarCard } from "@/components/car/car-card";
import { DayOfWeekEnum as DayOfWeek } from "@/enums/day-of-week";

const DAYS_ORDER = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

/**
 * SEO metadata for a dealer profile.
 *
 * @param params - Route params containing the dealer slug
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getDealerBySlug(slug);
  const dealer = result.success ? result.data : null;

  if (!dealer) {
    return { title: "Dealer Not Found" };
  }

  return {
    title: dealer.name,
    description:
      dealer.bio?.substring(0, 160) ||
      `Browse cars from ${dealer.name}${dealer.city ? ` in ${dealer.city}` : ""}`,
    openGraph: {
      images: dealer.coverImageUrl
        ? [dealer.coverImageUrl]
        : dealer.logoUrl
          ? [dealer.logoUrl]
          : [],
    },
  };
}

/**
 * Public dealer profile: cover, logo, contact details, opening hours and the
 * dealer's available cars.
 *
 * @param params - Route params containing the dealer slug
 */
export default async function DealerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getDealerBySlug(slug);

  if (!result.success || !result.data) {
    notFound();
  }

  const dealer = result.data;
  const hours = [...dealer.workingHours].sort(
    (a, b) => DAYS_ORDER.indexOf(a.dayOfWeek) - DAYS_ORDER.indexOf(b.dayOfWeek),
  );
  const whatsapp = dealer.whatsappPhone?.replace(/[^\d]/g, "");

  return (
    <div className="py-8">
      <div className="relative h-48 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-500 md:h-64">
        {dealer.coverImageUrl && (
          <Image
            src={dealer.coverImageUrl}
            alt={`${dealer.name} cover`}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
      </div>

      <div className="-mt-12 flex flex-col gap-4 px-4 md:flex-row md:items-end md:px-8">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
          {dealer.logoUrl ? (
            <Image
              src={dealer.logoUrl}
              alt={`${dealer.name} logo`}
              fill
              sizes="96px"
              className="object-cover"
            />
          ) : (
            <Store className="h-10 w-10 text-gray-400" />
          )}
        </div>
        <div className="pb-2">
          <h1 className="font-bold text-3xl md:text-4xl">{dealer.name}</h1>
          {dealer.city && (
            <p className="flex items-center gap-1 text-gray-600">
              <MapPin className="h-4 w-4" />
              {dealer.city}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <aside className="space-y-6 lg:col-span-1">
          {dealer.bio && (
            <section className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-2 font-semibold text-lg">About</h2>
              <p className="whitespace-pre-line text-gray-700">{dealer.bio}</p>
            </section>
          )}

          <section className="space-y-3 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-2 font-semibold text-lg">Contact</h2>
            {dealer.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dealer.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-gray-700 hover:text-blue-600"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {dealer.address}
              </a>
            )}
            {dealer.phone && (
              <a
                href={`tel:${dealer.phone}`}
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600"
              >
                <Phone className="h-4 w-4" />
                {dealer.phone}
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-700 hover:text-green-600"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            )}
            {dealer.email && (
              <a
                href={`mailto:${dealer.email}`}
                className="flex items-center gap-2 text-gray-700 hover:text-blue-600"
              >
                <Mail className="h-4 w-4" />
                {dealer.email}
              </a>
            )}
            {!dealer.address && !dealer.phone && !whatsapp && !dealer.email && (
              <p className="text-gray-500">No contact details provided.</p>
            )}
          </section>

          {hours.length > 0 && (
            <section className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-lg">
                <Clock className="h-4 w-4" />
                Opening hours
              </h2>
              <div className="space-y-1 text-sm">
                {hours.map((day) => (
                  <div key={day.dayOfWeek} className="flex justify-between">
                    <span className="text-gray-600">
                      {day.dayOfWeek.charAt(0) +
                        day.dayOfWeek.slice(1).toLowerCase()}
                    </span>
                    <span>
                      {day.isOpen
                        ? `${day.openTime} - ${day.closeTime}`
                        : "Closed"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>

        <section className="lg:col-span-2">
          <h2 className="mb-4 font-bold text-2xl">
            Cars for sale ({dealer.cars.length})
          </h2>
          {dealer.cars.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-gray-600">
              This dealer has no cars listed right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {dealer.cars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

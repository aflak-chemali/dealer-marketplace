import type { DealerProfileFormData } from "@/schemas/dealer/dealer-profile.schema";

/**
 * Maps validated dealer profile form data to a `Dealer` row, storing empty
 * optional fields as null.
 */
export function toDealerRow(data: DealerProfileFormData) {
  const orNull = (value?: string) => (value?.trim() ? value.trim() : null);
  return {
    name: data.name.trim(),
    slug: data.slug.trim(),
    bio: orNull(data.bio),
    phone: orNull(data.phone),
    whatsappPhone: orNull(data.whatsappPhone),
    email: orNull(data.email),
    address: orNull(data.address),
    city: orNull(data.city),
  };
}

/** Friendly message for Postgres unique violations on the dealer slug. */
export function dealerWriteErrorMessage(error: {
  code?: string;
  message: string;
}): string {
  if (error.code === "23505") {
    return error.message.includes("ownerId")
      ? "You already have a dealer profile."
      : "That profile URL is already taken. Please choose another.";
  }
  return error.message;
}

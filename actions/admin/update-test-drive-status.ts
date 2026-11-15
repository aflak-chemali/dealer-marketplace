"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/routes";
import { BookingStatusEnum as BookingStatus } from "@/enums/booking-status";
import { getLogger } from "@/lib/logger";
import { ensureDealerUser } from "@/lib/supabase/ensure-dealer-user";
import type { ActionResponse } from "@/types/common/action-response";

const log = getLogger(["app", "actions", "admin"]);

/**
 * Updates booking status from admin panel.
 * Revalidates admin and user reservation pages.
 *
 * @param bookingId - Target booking ID
 * @param newStatus - New status to apply
 * @returns Success message or error
 * @see ROUTES.ADMIN.ADMIN_TEST_DRIVES - Admin test drives page
 * @see ROUTES.RESERVATIONS - User reservations page
 */
export async function updateTestDriveStatus(
  bookingId: string,
  newStatus: BookingStatus,
): Promise<ActionResponse<string>> {
  try {
    const { supabase, dealerId, isSuperAdmin } = await ensureDealerUser();

    // Get the booking
    const { data: booking } = await supabase
      .from("TestDriveBooking")
      .select("*")
      .eq("id", bookingId)
      .single();

    // Dealers can only manage bookings for their own cars
    if (!booking || (!isSuperAdmin && booking.dealerId !== dealerId)) {
      throw new Error("Booking not found");
    }

    // Validate status
    const validStatuses: BookingStatus[] = [
      BookingStatus.PENDING,
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.NO_SHOW,
    ];
    if (!validStatuses.includes(newStatus)) {
      return {
        success: false,
        error: "Invalid status",
      };
    }

    // Update status
    const { error: updateError } = await supabase
      .from("TestDriveBooking")
      .update({ status: newStatus })
      .eq("id", bookingId);

    if (updateError) throw updateError;

    log.info(
      "Test drive status updated successfully (bookingId: {bookingId}, status: {newStatus})",
      { bookingId, newStatus },
    );

    // Revalidate paths
    revalidatePath(ROUTES.ADMIN.ADMIN_TEST_DRIVES);
    revalidatePath(ROUTES.RESERVATIONS);

    return {
      success: true,
      data: "Test drive status updated successfully",
    };
  } catch (error) {
    log.error(
      "Error updating test drive status (bookingId: {bookingId}): {error}",
      {
        bookingId,
        error: (error as Error).message,
      },
    );
    throw new Error(
      `Error updating test drive status:${(error as Error).message}`,
    );
  }
}

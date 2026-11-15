"use server";

import { revalidatePath } from "next/cache";
import { getLogger } from "@/lib/logger";
import {
  carStorageFolder,
  ensureDealerUser,
} from "@/lib/supabase/ensure-dealer-user";
import { createAdminClient } from "@/lib/supabase/supabase";
import type { ActionResponse } from "@/types/common/action-response";

const log = getLogger(["app", "actions", "cars"]);

/**
 * Deletes car and associated images from storage.
 * Removes the entire car folder from storage.
 * Best-effort storage cleanup - proceeds even if fails.
 * Revalidates admin car list.
 *
 * @param id - Car ID to delete
 * @returns Success result or error
 * @see createAdminClient - Service role client for storage deletion
 * @see https://supabase.com/docs/reference/javascript/storage-from-remove
 */
export async function deleteCar(id: string): Promise<ActionResponse<null>> {
  try {
    const { supabase, dealerId, isSuperAdmin } = await ensureDealerUser();

    // Dealers can only delete their own listings
    if (!isSuperAdmin) {
      const { data: ownedCar } = await supabase
        .from("Car")
        .select("id")
        .eq("id", id)
        .eq("dealerId", dealerId)
        .maybeSingle();

      if (!ownedCar) {
        throw new Error("Car not found");
      }
    }

    // Delete associated test drive bookings first to avoid FK constraint violation
    const { error: bookingsError } = await supabase
      .from("TestDriveBooking")
      .delete()
      .eq("carId", id);

    if (bookingsError) {
      log.error(
        "Error deleting test drive bookings for car (id: {id}): {message}",
        {
          id,
          message: bookingsError.message,
        },
      );
      throw bookingsError;
    }

    // Delete the car from the database
    const { data: deletedRows, error: deleteError } = await supabase
      .from("Car")
      .delete()
      .eq("id", id)
      .select("images, dealerId");

    if (deleteError) {
      log.error("Database error deleting car (id: {id}): {message}", {
        id,
        message: deleteError.message,
      });
      throw deleteError;
    }

    // Delete the car's image folder from Supabase storage
    try {
      const supabaseAdmin = createAdminClient();
      const deleted = Array.isArray(deletedRows) ? deletedRows[0] : null;
      const folders = new Set<string>([carStorageFolder(id, null)]);
      if (deleted?.dealerId) {
        folders.add(carStorageFolder(id, deleted.dealerId));
      }

      const filePaths: string[] = [];
      for (const folderPath of folders) {
        // List all files in the car's folder
        const { data: files, error: listError } = await supabaseAdmin.storage
          .from("car-images")
          .list(folderPath);

        if (listError) {
          log.error(
            "Error listing car images for deletion (id: {id}): {message}",
            {
              id,
              message: listError.message,
            },
          );
        } else if (files && files.length > 0) {
          filePaths.push(...files.map((file) => `${folderPath}/${file.name}`));
        }
      }

      if (filePaths.length > 0) {
        // Delete all files
        const { error: removeError } = await supabaseAdmin.storage
          .from("car-images")
          .remove(filePaths);

        if (removeError) {
          log.error(
            "Error deleting car images from storage (id: {id}): {message}",
            {
              id,
              message: removeError.message,
            },
          );
        }
      }
    } catch (storageError) {
      log.error(
        "Error with storage operations during car delete (id: {id}): {error}",
        {
          id,
          error: (storageError as Error).message,
        },
      );
      // Continue with the function even if storage operations fail
    }

    log.info("Car deleted successfully (id: {id})", { id });

    // Revalidate the cars list page
    revalidatePath("/admin/cars");

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    log.error("Error deleting car (id: {id}): {error}", {
      id,
      error: (error as Error).message,
    });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

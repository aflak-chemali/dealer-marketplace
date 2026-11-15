"use server";

import { revalidatePath } from "next/cache";
import { validateFileSizes } from "@/actions/cars/validate-file-sizes";
import { checkStorageQuota } from "@/actions/storage/check-storage-quota";
import { env } from "@/config/env";
import { ROUTES } from "@/config/routes";
import type { CarStatusEnum as CarStatus } from "@/enums/car-status";
import { getLogger } from "@/lib/logger";
import {
  carStorageFolder,
  ensureDealerUser,
} from "@/lib/supabase/ensure-dealer-user";
import { createAdminClient } from "@/lib/supabase/supabase";
import type { CarFormData } from "@/types/car/car-form-data";
import type { ActionResponse } from "@/types/common/action-response";

const log = getLogger(["app", "actions", "cars"]);

const MAX_IMAGES_PER_CAR = env.NEXT_PUBLIC_MAX_IMAGES_PER_CAR ?? 8;

/** Extracts the object path inside the `car-images` bucket from a public URL. */
function storagePathFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const pathMatch = url.pathname.match(/\/car-images\/(.*)/);
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Updates existing car with data and image changes.
 * Handles three image operations: keep existing, remove, add new.
 * Validates at least one image remains after removals.
 * Revalidates admin list and public detail page.
 *
 * @param formData - FormData with 'carId', 'carData' (JSON), 'newImages' (File[]), 'imagesToRemove' (string[])
 * @returns Success result or error
 * @see ROUTES.HOME.CAR_DETAILS - Public detail page
 * @see ROUTES.ADMIN.ADMIN_CARS - Admin car list
 */
export async function updateCar(
  formData: FormData,
): Promise<ActionResponse<null>> {
  try {
    const carId = formData.get("carId") as string;
    const carDataRaw = formData.get("carData");
    if (!carId || !carDataRaw) throw new Error("Car ID and data are required");
    const carData = JSON.parse(carDataRaw as string) as CarFormData;

    const newImages = (formData.getAll("newImages") || []) as File[];
    const imagesToRemove = (formData.getAll("imagesToRemove") ||
      []) as string[];

    const { supabase, dealerId, isSuperAdmin } = await ensureDealerUser();

    // Get current car data
    const { data: existingCar, error: fetchError } = await supabase
      .from("Car")
      .select("images, dealerId")
      .eq("id", carId)
      .single();

    if (
      fetchError ||
      !existingCar ||
      (!isSuperAdmin && existingCar.dealerId !== dealerId)
    ) {
      return {
        success: false,
        error: "Car not found",
      };
    }

    // Handle image operations
    let finalImages = [...existingCar.images];
    const supabaseAdmin = createAdminClient();

    // Check storage quota
    const newImagesSize = newImages.reduce((acc, img) => acc + img.size, 0);
    let removedImagesSize = 0;

    const remainingCount = existingCar.images.filter(
      (img: string) => !imagesToRemove.includes(img),
    ).length;
    if (remainingCount + newImages.length > MAX_IMAGES_PER_CAR) {
      throw new Error(
        `A listing can have at most ${MAX_IMAGES_PER_CAR} images.`,
      );
    }

    if (imagesToRemove.length > 0) {
      // Group removed files by their storage directory (legacy or dealer-scoped)
      const removedByDir = new Map<string, string[]>();
      for (const url of imagesToRemove) {
        const path = storagePathFromUrl(url);
        if (!path) continue;
        const idx = path.lastIndexOf("/");
        const dir = path.slice(0, idx);
        const name = path.slice(idx + 1);
        removedByDir.set(dir, [...(removedByDir.get(dir) ?? []), name]);
      }

      for (const [dir, names] of removedByDir) {
        const { data: storageFiles } = await supabaseAdmin.storage
          .from("car-images")
          .list(dir);

        if (storageFiles) {
          removedImagesSize += storageFiles
            .filter((f) => f.name && names.includes(f.name))
            .reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
        }
      }
    }

    const { allowed } = await checkStorageQuota(
      newImagesSize - removedImagesSize,
    );
    if (!allowed) {
      throw new Error(
        "Global storage limit reached. Please contact support or delete existing files.",
      );
    }

    // Remove images if requested
    if (imagesToRemove.length > 0) {
      const filePaths = imagesToRemove
        .map(storagePathFromUrl)
        .filter((path: string | null): path is string => path !== null);

      if (filePaths.length > 0) {
        const { error } = await supabaseAdmin.storage
          .from("car-images")
          .remove(filePaths);

        if (error) {
          log.error("Error deleting images: {message}", {
            message: error.message,
          });
        }
      }

      finalImages = finalImages.filter(
        (img: string) => !imagesToRemove.includes(img),
      );
    }

    // Upload new images if provided
    if (newImages.length > 0) {
      // Validate new image sizes
      validateFileSizes(newImages);

      const folderPath = carStorageFolder(carId, existingCar.dealerId);
      const newImageUrls: string[] = [];

      for (let i = 0; i < newImages.length; i++) {
        const file = newImages[i];

        // Skip if not a valid file
        if (!file || !(file instanceof File)) {
          continue;
        }

        const imageBuffer = Buffer.from(await file.arrayBuffer());
        const contentType = file.type || "image/jpeg";
        const fileExtension = contentType.split("/")[1] || "jpeg";

        const fileName = `image-${Date.now()}-${i}.${fileExtension}`;
        const filePath = `${folderPath}/${fileName}`;

        const { error } = await supabaseAdmin.storage
          .from("car-images")
          .upload(filePath, imageBuffer, {
            contentType,
          });

        if (error) {
          log.error("Error uploading image: {message}", {
            message: error.message,
          });
          throw new Error(`Failed to upload image: ${error.message}`);
        }

        const publicUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/car-images/${filePath}`;
        newImageUrls.push(publicUrl);
      }

      finalImages = [...finalImages, ...newImageUrls];
    }

    // Ensure at least one image remains
    if (finalImages.length === 0) {
      log.warn("Attempted to update car without any images (id: {carId})", {
        carId,
      });
      return {
        success: false,
        error: "At least one image is required",
      };
    }

    // Calculate storage delta and fetch current storage_bytes
    const { data: currentCar } = await supabase
      .from("Car")
      .select("storage_bytes")
      .eq("id", carId)
      .single();

    const currentStorageBytes = currentCar?.storage_bytes || 0;
    const netStorageChange = newImagesSize - removedImagesSize;
    const newStorageBytes = Math.max(0, currentStorageBytes + netStorageChange);

    // Update the car in the database
    const { error: updateError } = await supabase
      .from("Car")
      .update({
        carMakeId: carData.carMakeId,
        carColorId: carData.carColorId,
        model: carData.model,
        year: carData.year,
        price: carData.price.toString(),
        mileage: carData.mileage,
        fuelType: carData.fuelType,
        transmission: carData.transmission,
        bodyType: carData.bodyType,
        numberPlate: carData.numberPlate,
        seats: carData.seats,
        description: carData.description,
        status: carData.status as CarStatus,
        featured: carData.featured,
        features: carData.features || [],
        images: finalImages,
        storage_bytes: newStorageBytes,
      })
      .eq("id", carId);

    if (updateError) {
      log.error("Database error updating car: {message}", {
        message: updateError.message,
      });
      throw updateError;
    }

    log.info("Car updated successfully (id: {carId})", { carId });

    // Revalidate pages
    revalidatePath(ROUTES.ADMIN.ADMIN_CARS);
    revalidatePath(ROUTES.HOME.CAR_DETAILS(carId));

    return {
      success: true,
      data: null,
    };
  } catch (error) {
    log.error("Failed to update car: {error}", {
      error: (error as Error).message,
    });
    throw new Error(`Error updating car: ${(error as Error).message}`);
  }
}

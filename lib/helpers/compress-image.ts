/**
 * Options for {@link compressImage}.
 */
export interface CompressImageOptions {
  /** Longest edge in pixels after resizing. */
  maxDimension?: number;
  /** Encoder quality between 0 and 1. */
  quality?: number;
  /** Output MIME type. WebP gives the best size on the free storage tier. */
  mimeType?: "image/webp" | "image/jpeg";
}

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Downscales and re-encodes an image in the browser before upload to keep
 * storage usage low (Supabase free tier offers 1 GB). Returns the original
 * file when compression is unsupported or would not make it smaller.
 *
 * @param file - Image selected by the user
 * @param options - Resize and encoding options
 * @returns Compressed file, or the original file
 */
export async function compressImage(
  file: File,
  {
    maxDimension = 1600,
    quality = 0.8,
    mimeType = "image/webp",
  }: CompressImageOptions = {},
): Promise<File> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof createImageBitmap !== "function" ||
    !COMPRESSIBLE_TYPES.has(file.type)
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close?.();
      return file;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mimeType, quality),
    );
    if (!blob || blob.size >= file.size) return file;

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

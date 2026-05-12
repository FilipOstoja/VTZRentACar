import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Uploads a receipt image to the `receipts` storage bucket and returns the path.
 * Returns null if no file given or upload fails.
 */
export async function uploadReceipt(
  supabase: SupabaseClient,
  file: File | null,
  prefix = "receipts"
): Promise<string | null> {
  if (!file) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Receipt upload failed:", error);
    return null;
  }

  return path;
}

/** Returns a signed URL for a stored receipt path (or null). */
export async function getReceiptUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
  expiresInSeconds = 3600
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl || null;
}

import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

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

  const ext = RECEIPT_TYPES[file.type];
  if (!ext || file.size > MAX_RECEIPT_BYTES) {
    console.error("Receipt upload rejected: invalid type or size");
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "") || "receipts";
  const path = `${user.id}/${safePrefix}/${crypto.randomUUID()}.${ext}`;

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

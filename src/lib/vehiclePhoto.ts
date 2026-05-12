/**
 * Maps make + model to a photo file in /public/vehicles/.
 * Matching is case-insensitive and substring-based so minor typos still resolve.
 */
export function getVehiclePhoto(make: string, model: string): string | null {
  const mk = (make ?? "").toLowerCase();
  const mo = (model ?? "").toLowerCase();
  const full = `${mk} ${mo}`;

  if (full.includes("crafter")) return "/vehicles/crafter.jpg";
  if (mo.includes("golf 8") || mo.includes("golf8") || mo === "golf viii")
    return "/vehicles/golf-8-manual.jpg";
  if (
    mo.includes("passat") &&
    (mo.includes("estate") || mo.includes("variant") || mo.includes("sw") || mo.includes("kombi") || mo.includes("karavan"))
  )
    return "/vehicles/passat-estate.jpg";
  if (mo.includes("passat")) return "/vehicles/passat-sedan.jpg";

  return null;
}

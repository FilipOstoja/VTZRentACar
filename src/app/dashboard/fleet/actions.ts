"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VehicleStatus = "free" | "rented" | "service" | "washing" | "inactive";

interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function setVehicleStatus(
  vehicleId: string,
  status: VehicleStatus,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("vehicles")
    .update({ status })
    .eq("id", vehicleId);

  if (error) {
    console.error("[setVehicleStatus]", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/fleet");

  return { ok: true };
}

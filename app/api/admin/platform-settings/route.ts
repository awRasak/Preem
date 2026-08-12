import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  dropCommissionBps: z.number().int().min(0).max(10000),
  giftCommissionBps: z.number().int().min(0).max(10000),
});

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      drop_commission_bps: parsed.data.dropCommissionBps,
      gift_commission_bps: parsed.data.giftCommissionBps,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

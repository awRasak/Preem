import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";

const schema = z
  .object({
    dropCommissionBps: z.number().int().min(0).max(10000),
    giftCommissionBps: z.number().int().min(0).max(10000),
    paystackEnabled: z.boolean(),
    monipayEnabled: z.boolean(),
    waitlistModeEnabled: z.boolean(),
  })
  .refine((v) => v.paystackEnabled || v.monipayEnabled, {
    message: "At least one payment gateway must stay on.",
  });

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // parseBody handles content-type/JSON robustness with a permissive
  // schema; the real schema runs here so the refine message ("At least one
  // payment gateway must stay on.") still reaches the settings UI.
  const raw = await parseBody(req, z.unknown());
  if (!raw.ok) return raw.response;

  const parsed = schema.safeParse(raw.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      drop_commission_bps: parsed.data.dropCommissionBps,
      gift_commission_bps: parsed.data.giftCommissionBps,
      paystack_enabled: parsed.data.paystackEnabled,
      monipay_enabled: parsed.data.monipayEnabled,
      waitlist_mode_enabled: parsed.data.waitlistModeEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (error) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

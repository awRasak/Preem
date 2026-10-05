import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";

const schema = z.object({
  fulfillment: z.enum(["pending", "preparing", "shipped", "delivered"]),
});

// Ops advances merch fulfillment (Preem ships, artists don't). Any state is
// settable directly -- a mis-scan is corrected by just tapping the right
// one, no transition machine to fight.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("merch_orders")
    .update({ fulfillment: parsed.data.fulfillment })
    .eq("id", id)
    .eq("status", "success")
    .select("id")
    .single();

  if (error || !order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
// MIN_CHECKOUT_KOBO no longer needed - tiers handle pricing
import { parseBody } from "@/lib/http";

const tierSchema = z.object({
  name: z.string().trim().min(1).max(60),
  price_kobo: z.number().int().positive().max(10_000_000),
  quantity: z.number().int().positive().max(100_000),
  design: z.enum(["standard", "vip", "premium", "table", "backstage"]).default("standard"),
});

const timeSchema = z.object({
  label: z.string().trim().min(1).max(60),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }).optional().nullable(),
  sort_order: z.number().int().min(0).optional(),
});

const editSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  venue: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  start_at: z.string().datetime({ offset: true }),
  end_at: z.string().datetime({ offset: true }).optional().nullable(),
  sales_close_at: z.string().datetime({ offset: true }).optional().nullable(),
  cover_art_path: z.string().trim().max(400).optional().nullable(),
  tiers: z.array(tierSchema).min(1, "At least one ticket tier is required."),
  times: z.array(timeSchema).optional(),
});

function validId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!validId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const parsed = await parseBody(req, editSchema);
  if (!parsed.ok) return parsed.response;
  const { title, description, venue, city, start_at, end_at, sales_close_at, cover_art_path, tiers, times } =
    parsed.data;

  const start = new Date(start_at);
  if (!Number.isFinite(start.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  const salesClose = sales_close_at ? new Date(sales_close_at) : null;
  if (salesClose && !Number.isFinite(salesClose.getTime())) {
    return NextResponse.json({ error: "Invalid sales close date" }, { status: 400 });
  }
  if (salesClose && salesClose.getTime() > start.getTime()) {
    return NextResponse.json(
      { error: "Sales must close at or before the show starts." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  const { data: existingTiers } = await supabase
    .from("show_ticket_tiers")
    .select("id")
    .eq("show_id", id);
  const tierIds = (existingTiers ?? []).map((t) => t.id);
  let reservedTotal = 0;
  if (tierIds.length > 0) {
    const { count } = await supabase
      .from("show_tickets")
      .select("id", { count: "exact", head: true })
      .in("tier_id", tierIds)
      .in("status", ["pending", "success"]);
    reservedTotal = count ?? 0;
  } else {
    const { count } = await supabase
      .from("show_tickets")
      .select("id", { count: "exact", head: true })
      .eq("show_id", id)
      .is("tier_id", null)
      .in("status", ["pending", "success"]);
    reservedTotal = count ?? 0;
  }

  const newTotal = tiers.reduce((sum, t) => sum + t.quantity, 0);
  if (newTotal < reservedTotal) {
    return NextResponse.json(
      { error: "Total tickets cant be less than " + reservedTotal + " already sold/reserved." },
      { status: 400 },
    );
  }

  const basePrice = Math.min(...tiers.map((t) => t.price_kobo));

  const { data, error } = await supabase
    .from("shows")
    .update({
      title,
      description: description && description.trim() ? description.trim() : null,
      venue: venue && venue.trim() ? venue.trim() : null,
      city: city && city.trim() ? city.trim() : null,
      start_at: start.toISOString(),
      end_at: end_at ? new Date(end_at).toISOString() : null,
      sales_close_at: salesClose ? salesClose.toISOString() : null,
      ticket_price_kobo: basePrice,
      total_tickets: newTotal,
      cover_art_path: cover_art_path ?? null,
    })
    .eq("id", id)
    .select("id, slug, title")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Could not update event." }, { status: 500 });
  }

  await supabase.from("show_ticket_tiers").delete().eq("show_id", id);
  const tierRows = tiers.map((t, i) => ({
    show_id: id,
    name: t.name,
    price_kobo: t.price_kobo,
    quantity: t.quantity,
    design: t.design,
    sort_order: i,
  }));
  const { error: tierError } = await supabase.from("show_ticket_tiers").insert(tierRows);
  if (tierError) {
    return NextResponse.json({ error: "Event updated but tiers failed to save." }, { status: 500 });
  }

  // Replace times.
  await supabase.from("show_times").delete().eq("show_id", id);
  if (times && times.length > 0) {
    const timeRows = times.map((t, i) => ({
      show_id: id,
      label: t.label,
      start_at: t.start_at,
      end_at: t.end_at ?? null,
      sort_order: t.sort_order ?? i,
    }));
    await supabase.from("show_times").insert(timeRows);
  }

  return NextResponse.json({ ok: true, show: data });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!validId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("shows")
    .update({ status: "cancelled" })
    .eq("id", id)
    .select("id, title")
    .single();

  if (!data) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  return NextResponse.json({ show: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  if (!validId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { count } = await supabase
    .from("show_tickets")
    .select("id", { count: "exact", head: true })
    .eq("show_id", id)
    .eq("status", "success");
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cannot delete an event with sold tickets. Cancel it instead." },
      { status: 400 },
    );
  }

  await supabase.from("show_ticket_tiers").delete().eq("show_id", id);
  const { error } = await supabase.from("shows").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Could not delete event." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

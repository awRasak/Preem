import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/http";

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  priceKobo: z.number().int().min(1).optional(),
  stock: z.number().int().min(0).optional(),
  photoPath: z.string().trim().max(500).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
});

async function ownedItem(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from("merch_items")
    .select("id, stock, status")
    .eq("id", id)
    .eq("artist_id", userId)
    .maybeSingle();
  return data;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { id } = await params;

  const parsed = await parseBody(req, updateSchema);
  if (!parsed.ok) return parsed.response;

  const existing = await ownedItem(supabase, id, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.priceKobo !== undefined) patch.price_kobo = parsed.data.priceKobo;
  if (parsed.data.stock !== undefined) patch.stock = parsed.data.stock;
  if (parsed.data.photoPath !== undefined) patch.photo_path = parsed.data.photoPath;
  if (parsed.data.status !== undefined) {
    // Same guard as create: a published item with no stock is a dead button.
    const stock = parsed.data.stock ?? existing.stock;
    patch.status = parsed.data.status === "published" && stock <= 0 ? "draft" : parsed.data.status;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("merch_items")
    .update(patch)
    .eq("id", id)
    .eq("artist_id", user.id)
    .select("*")
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Could not update item." }, { status: 500 });
  }
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { id } = await params;

  const existing = await ownedItem(supabase, id, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Orders reference items with ON DELETE RESTRICT -- an item with any order
  // history can't be deleted, only unpublished. Check first for a clean
  // message instead of a raw FK error.
  const { count } = await supabase
    .from("merch_orders")
    .select("id", { count: "exact", head: true })
    .eq("item_id", id);
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "This item has orders — unpublish it instead of deleting." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("merch_items")
    .delete()
    .eq("id", id)
    .eq("artist_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Could not delete item." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

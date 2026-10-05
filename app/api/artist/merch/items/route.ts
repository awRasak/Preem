import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/http";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  priceKobo: z.number().int().min(1),
  stock: z.number().int().min(0),
  photoPath: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["draft", "published"]).default("draft"),
});

// Artist merch catalogue. Reads and writes are scoped to the signed-in
// artist's own rows (RLS mirrors this, belt and suspenders).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const { data: items } = await supabase
    .from("merch_items")
    .select("*")
    .eq("artist_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ items: items ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, createSchema);
  if (!parsed.ok) return parsed.response;

  // Publishing with zero stock is a broken buy button -- keep it a draft.
  const status =
    parsed.data.status === "published" && parsed.data.stock <= 0
      ? "draft"
      : parsed.data.status;

  const { data: item, error } = await supabase
    .from("merch_items")
    .insert({
      artist_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      price_kobo: parsed.data.priceKobo,
      stock: parsed.data.stock,
      photo_path: parsed.data.photoPath ?? null,
      status,
    })
    .select("*")
    .single();

  if (error || !item) {
    return NextResponse.json({ error: "Could not create item." }, { status: 500 });
  }
  return NextResponse.json({ item });
}

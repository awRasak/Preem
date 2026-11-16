import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";

const createSchema = z.object({
  artistId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  priceKobo: z.number().int().min(1),
  stock: z.number().int().min(0),
  photoPath: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, createSchema);
  if (!parsed.ok) return parsed.response;

  // Every staged file must belong to the target artist's folder.
  if (parsed.data.photoPath && !parsed.data.photoPath.startsWith(`${parsed.data.artistId}/`)) {
    return NextResponse.json({ error: "Invalid photo path." }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("id", parsed.data.artistId)
    .eq("approval_status", "approved")
    .maybeSingle();
  if (!artist) {
    return NextResponse.json({ error: "Artist not found." }, { status: 404 });
  }

  // Publishing with zero stock is a broken buy button -- keep it a draft.
  const status =
    parsed.data.status === "published" && parsed.data.stock <= 0
      ? "draft"
      : parsed.data.status;

  const { data: item, error } = await supabase
    .from("merch_items")
    .insert({
      artist_id: parsed.data.artistId,
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
    return NextResponse.json({ error: "Could not create merch item." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, item });
}

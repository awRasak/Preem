import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { ids } = parsed.data;

  const { data: owned } = await supabase
    .from("bio_links")
    .select("id, label, url")
    .eq("artist_id", user.id);

  const ownedMap = new Map((owned ?? []).map((l) => [l.id, l]));
  if (!ids.every((id) => ownedMap.has(id))) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { error } = await supabase
    .from("bio_links")
    .upsert(
      ids.map((id, i) => ({
        id,
        sort_order: i,
        artist_id: user.id,
        label: ownedMap.get(id)!.label,
        url: ownedMap.get(id)!.url,
      })),
      { onConflict: "id" },
    );

  if (error) {
    return NextResponse.json({ error: "Could not reorder links." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
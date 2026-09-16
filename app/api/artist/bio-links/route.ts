import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  label: z.string().trim().min(1).max(60),
  url: z.string().trim().url().max(500),
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
  const { label, url } = parsed.data;

  const { data: existing } = await supabase
    .from("bio_links")
    .select("sort_order")
    .eq("artist_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = ((existing?.sort_order ?? -1) + 1) % 1000;

  const { data, error } = await supabase
    .from("bio_links")
    .insert({ artist_id: user.id, label, url, sort_order: nextOrder })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not save link." }, { status: 500 });
  }

  return NextResponse.json({ link: data });
}
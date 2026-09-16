import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    label: z.string().trim().min(1).max(60),
    url: z.string().trim().url().max(500),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { data, error } = await supabase
    .from("bio_links")
    .update(parsed.data)
    .eq("id", id)
    .eq("artist_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Could not update link." }, { status: 500 });
  }

  return NextResponse.json({ link: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await supabase
    .from("bio_links")
    .delete()
    .eq("id", id)
    .eq("artist_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Could not delete link." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
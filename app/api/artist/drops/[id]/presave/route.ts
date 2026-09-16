import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseBody } from "@/lib/http";

// Artist toggles the public pre-save page for one of their draft drops.
const schema = z.object({ enabled: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const { id } = await params;
  const { data: drop } = await supabase
    .from("drops")
    .select("id, status")
    .eq("id", id)
    .eq("artist_id", user.id)
    .single();
  if (!drop) {
    return NextResponse.json({ error: "Drop not found" }, { status: 404 });
  }
  if (drop.status !== "draft") {
    return NextResponse.json(
      { error: "Only drafts can be opened for pre-save." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("drops")
    .update({ presave_enabled: parsed.data.enabled })
    .eq("id", id)
    .eq("artist_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Could not update pre-save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, presave_enabled: parsed.data.enabled });
}
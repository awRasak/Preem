import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// v1 show management is intentionally minimal: create + cancel. Editing an
// existing show (date moves, price changes) can come later -- cancellation
// is the fast-safe action that stops ticket sales immediately.
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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data } = await supabase
    .from("shows")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("artist_id", user.id)
    .select("id, title")
    .single();

  if (!data) {
    return NextResponse.json({ error: "Show not found" }, { status: 404 });
  }

  return NextResponse.json({ show: data });
}
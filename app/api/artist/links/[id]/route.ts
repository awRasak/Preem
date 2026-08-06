import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await supabase
    .from("artist_links")
    .delete()
    .eq("id", id)
    .eq("artist_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Could not remove link." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

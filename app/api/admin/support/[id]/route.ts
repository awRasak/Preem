import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("support_requests")
    .update({ status: "resolved" })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not update request" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("artists")
    .update({ approval_status: parsed.data.status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not update artist" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

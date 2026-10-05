import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Contributor picker: approved artists by stage-name prefix. Excludes self
// (the wizard adds the owner row itself) and caps results.
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ artists: [] });
  }

  const { data } = await supabase
    .from("artists")
    .select("id, stage_name, avatar_url")
    .eq("approval_status", "approved")
    .neq("id", user.id)
    .ilike("stage_name", `${q}%`)
    .order("stage_name", { ascending: true })
    .limit(8);

  return NextResponse.json({ artists: data ?? [] });
}

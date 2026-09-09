import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";

const schema = z.object({
  bucket: z.enum(["audio", "artwork"]),
  // Scoped to the target artist's folder, e.g. "<artistId>/track-<uuid>.mp3".
  // The drops route re-validates this on submit.
  path: z.string().trim().min(1).max(300),
});

export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(parsed.data.bucket)
    .createSignedUploadUrl(parsed.data.path);
  if (error || !data) {
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
  }
  return NextResponse.json({ signedUrl: data.signedUrl });
}

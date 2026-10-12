import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { submitDropJob } from "@/lib/distribution/submit";

export const maxDuration = 300;

const schema = z.object({
  // Optional YYYY-MM-DD override (exclusives have no window to derive from).
  streetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  stores: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
});

// Artist-triggered distribution: package the drop and submit it to the
// provider with the DSP street date. Idempotent-ish: an already submitted
// job returns its status instead of double-submitting.
export async function POST(
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

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;

  const result = await submitDropJob({
    admin: createAdminClient(),
    dropId: id,
    artistId: user.id,
    streetDateOverride: parsed.data.streetDate ?? null,
    stores: parsed.data.stores ?? [],
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ job: result.job, warning: result.warning });
}

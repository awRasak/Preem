import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseBody } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  phone: z.string().trim().min(5).max(20),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  dropId: z.string().uuid().optional(),
  message: z.string().trim().min(5).max(2000),
});

export async function POST(req: Request) {
  if (!rateLimit(`support-report:${clientIp(req)}`, { windowMs: 60 * 60 * 1000, max: 10 })) {
    return NextResponse.json(
      { error: "Too many reports — try again later." },
      { status: 429 },
    );
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { phone, email, dropId, message } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.from("support_requests").insert({
    fan_phone: phone,
    fan_email: email || null,
    drop_id: dropId || null,
    message,
  });

  if (error) {
    return NextResponse.json({ error: "Could not submit report." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountNumber } from "@/lib/paystack";
import { parseBody } from "@/lib/http";

const schema = z.object({
  bankCode: z.string().min(1),
  accountNumber: z.string().min(10).max(10),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const parsed = await parseBody(req, schema);
  if (!parsed.ok) return parsed.response;
  const { bankCode, accountNumber } = parsed.data;

  let resolved;
  try {
    resolved = await resolveAccountNumber({ accountNumber, bankCode });
  } catch {
    return NextResponse.json(
      { error: "Could not verify that account number." },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("artists")
    .update({
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: resolved.account_name,
      // bank details changed — previously created payout recipients are now
      // stale for BOTH gateways (each registers its own recipient code).
      paystack_recipient_code: null,
      monipay_recipient_code: null,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Could not save bank details." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, accountName: resolved.account_name });
}

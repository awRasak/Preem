import { NextResponse } from "next/server";
import { listBanks } from "@/lib/paystack";

export async function GET() {
  try {
    const banks = await listBanks();
    return NextResponse.json({ banks });
  } catch {
    return NextResponse.json({ error: "Could not load banks" }, { status: 502 });
  }
}

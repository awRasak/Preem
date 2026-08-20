"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

type Bank = { name: string; code: string };

export function BankDetailsForm({
  currentAccountName,
}: {
  currentAccountName: string | null;
}) {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/paystack/banks")
      .then((r) => r.json())
      .then((body) => {
        const banks = (body.banks ?? []) as Bank[];
        // Paystack's bank list can include multiple entries sharing a code
        // (e.g. different channels for the same bank) — dedupe for React keys.
        const seen = new Set<string>();
        const deduped = banks.filter((b) => {
          if (seen.has(b.code)) return false;
          seen.add(b.code);
          return true;
        });
        setBanks(deduped);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const res = await fetch("/api/artist/bank-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankCode, accountNumber }),
    });
    const body = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(body.error ?? "Could not save bank details.");
      return;
    }
    setSuccess(`Linked to ${body.accountName}`);
    router.refresh();
  }

  return (
    <>
      <p className="mb-4 text-xs text-muted">
        {currentAccountName
          ? `Currently linked: ${currentAccountName}`
          : "Add your bank details so weekly payouts can reach you."}
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="Bank">
          <select
            required
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-base text-paper focus:border-line-strong focus:outline-none"
          >
            <option value="">Select bank</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account number">
          <Input
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="10-digit NUBAN"
            maxLength={10}
          />
        </Field>
        {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
        {success && <p className="mb-3 text-sm text-[#34d399]">{success}</p>}
        <Button type="submit" variant="outline" disabled={loading}>
          {loading ? "Verifying…" : "Save bank account"}
        </Button>
      </form>
    </>
  );
}

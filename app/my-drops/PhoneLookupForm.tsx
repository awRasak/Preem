"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, Input } from "@/components/Field";
import { Button } from "@/components/Button";

export function PhoneLookupForm() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/my-drops/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    setLoading(false);
    if (!res.ok) {
      setError("Enter a valid phone number.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">My Drops</h1>
      <p className="mb-6 text-sm text-muted">
        Enter the phone number you used at checkout to see your library.
      </p>
      <form onSubmit={handleSubmit}>
        <Field label="Phone number">
          <Input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="080..."
          />
        </Field>
        {error && <p className="mb-4 text-sm text-[#ff6b6b]">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={loading}>
          {loading ? "…" : "View my drops"}
        </Button>
      </form>
    </div>
  );
}

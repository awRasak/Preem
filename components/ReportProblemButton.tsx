"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Field, Input, Textarea } from "@/components/Field";

export function ReportProblemButton({
  defaultPhone = "",
  dropId,
  className = "",
}: {
  defaultPhone?: string;
  dropId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/support/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, email, dropId, message }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setError("Could not submit — try again.");
      return;
    }
    setDone(true);
  }

  function handleClose() {
    setOpen(false);
    setDone(false);
    setMessage("");
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-xs font-bold text-muted underline hover:text-paper ${className}`}
      >
        Report a problem
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-line-strong bg-surface p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center">
                <h3 className="mb-2 text-lg font-bold">Got it</h3>
                <p className="mb-4 text-sm text-muted">
                  We&apos;ll look into it and follow up if we need more info.
                </p>
                <Button variant="primary" className="w-full" onClick={handleClose}>
                  Close
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="mb-4 text-lg font-bold">Report a problem</h3>
                <Field label="Phone number (the one you checked out with)">
                  <Input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="080..."
                  />
                </Field>
                <Field label="Email (optional)">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                  />
                </Field>
                <Field label="What went wrong?">
                  <Textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="I paid but don't see my track..."
                  />
                </Field>
                {error && <p className="mb-3 text-sm text-[#ff6b6b]">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" className="flex-1" disabled={submitting}>
                    {submitting ? "…" : "Submit"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

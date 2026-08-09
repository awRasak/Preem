"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

export function SupportRequestRow({
  id,
  fanPhone,
  fanEmail,
  dropTitle,
  message,
  createdAt,
}: {
  id: string;
  fanPhone: string;
  fanEmail: string | null;
  dropTitle: string | null;
  message: string;
  createdAt: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resolve() {
    setLoading(true);
    await fetch(`/api/admin/support/${id}`, { method: "PATCH" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="border-b border-line py-4 last:border-none">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-bold">
          {fanPhone}
          {fanEmail && <span className="font-normal text-muted"> · {fanEmail}</span>}
        </div>
        <div className="text-[11px] text-muted">
          {new Date(createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>
      {dropTitle && <div className="mb-1.5 text-xs font-bold text-accent">{dropTitle}</div>}
      <p className="mb-3 text-sm text-muted">{message}</p>
      <Button
        variant="outline"
        disabled={loading}
        onClick={resolve}
        className="!px-3 !py-1.5 text-xs"
      >
        {loading ? "…" : "Mark resolved"}
      </Button>
    </div>
  );
}

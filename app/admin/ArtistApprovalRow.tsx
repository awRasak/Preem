"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";

export function ArtistApprovalRow({
  id,
  stageName,
  profileLink,
}: {
  id: string;
  stageName: string;
  profileLink: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function setStatus(status: "approved" | "rejected") {
    setLoading(true);
    await fetch(`/api/admin/artists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <tr className="border-b border-line last:border-none">
      <td className="py-3 pr-4 text-sm">{stageName}</td>
      <td className="py-3 pr-4 text-sm text-muted">
        {profileLink && (
          <a href={profileLink} target="_blank" rel="noopener noreferrer" className="underline">
            {profileLink}
          </a>
        )}
      </td>
      <td className="flex justify-end gap-2 py-3">
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setStatus("rejected")}
          className="!px-3 !py-1.5 text-xs"
        >
          Reject
        </Button>
        <Button
          variant="primary"
          disabled={loading}
          onClick={() => setStatus("approved")}
          className="!px-3 !py-1.5 text-xs"
        >
          Approve
        </Button>
      </td>
    </tr>
  );
}

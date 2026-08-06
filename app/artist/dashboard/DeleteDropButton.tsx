"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteDropButton({
  dropId,
  audioPath,
}: {
  dropId: string;
  audioPath: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this drop? Fans who already bought keep their access.")) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    await supabase.storage.from("audio").remove([audioPath]);
    await supabase.from("drops").delete().eq("id", dropId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-muted transition-colors hover:text-paper disabled:opacity-50"
    >
      {loading ? "…" : "Delete"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Spinner } from "@/components/Loader";

export function DeleteDropButton({
  dropId,
  audioPaths,
}: {
  dropId: string;
  audioPaths: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();
    if (audioPaths.length > 0) {
      await supabase.storage.from("audio").remove(audioPaths);
    }
    await supabase.from("drops").delete().eq("id", dropId);
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className="rounded-full border border-line-strong px-3 py-1.5 text-xs text-muted transition-colors hover:text-paper disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-flex items-center gap-1.5">
            <Spinner size="xs" /> Deleting…
          </span>
        ) : (
          "Delete"
        )}
      </button>
      <ConfirmDialog
        open={open}
        title="Delete drop?"
        description="Delete this drop? Fans who already bought keep their access. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => !loading && setOpen(false)}
        loading={loading}
      />
    </>
  );
}

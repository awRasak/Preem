import CreateDropWizard from "./CreateDropWizard";

import Link from "next/link";

export default function NewDropPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8">
        <Link href="/artist/drops" className="text-sm text-muted hover:text-paper">
          ← Drops
        </Link>
      </div>
      <CreateDropWizard />
    </>
  );
}

import Link from "next/link";
import { MarqueeManager } from "./MarqueeManager";

export const revalidate = 0;

export default function AdminMarqueePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8">
      <Link href="/admin" className="mb-4 inline-block text-sm text-muted hover:text-paper">
        ← Dashboard
      </Link>
      <MarqueeManager />
    </main>
  );
}

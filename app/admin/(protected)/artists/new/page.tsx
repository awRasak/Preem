import Link from "next/link";
import { NewArtistForm } from "./NewArtistForm";

export const revalidate = 0;

export default function AdminNewArtistPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8 sm:px-8">
      <Link href="/admin/artists" className="mb-4 inline-block text-sm text-muted hover:text-paper">
        ← Artists
      </Link>
      <h1 className="mb-6 text-xl font-bold">New artist</h1>
      <NewArtistForm />
    </main>
  );
}

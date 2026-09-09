import { NewArtistForm } from "./NewArtistForm";

export const revalidate = 0;

export default function AdminNewArtistPage() {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold">New artist</h1>
      <NewArtistForm />
    </main>
  );
}

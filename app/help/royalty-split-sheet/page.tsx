import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Music royalty split sheet tool for artists & producers — Preem",
  description:
    "A split sheet divides royalties between collaborators. Preem's split sheet tool records each contributor's share and pays everyone their cut automatically on every sale — in naira.",
};

const FAQ = [
  {
    q: "What is a split sheet in music?",
    a: "A split sheet is the written record of who owns what share of a song — the artist, featured artists, producers, writers — and in what percentages. It's what stops royalty arguments later, because everyone signed the same numbers.",
  },
  {
    q: "How does the split sheet tool on Preem work?",
    a: "When you set up a drop, you invite each collaborator and assign their share. On every sale, Preem automatically divides the payout: your collaborator's cut goes to them, yours stays with you — no invoices, no manual transfers, no chasing anyone at the end of the month.",
  },
  {
    q: "Do the splits have to add up to 100%?",
    a: "Yes — the shares on a track must total 100%. The tool enforces it as you type, so a track can never go live with shares that don't add up.",
  },
  {
    q: "How are collaborators paid out?",
    a: "Each collaborator gets their own artist account and bank details on file. Their share of every sale lands in their own balance and pays out on the regular payout run — in naira, to a Nigerian bank account.",
  },
  {
    q: "What if a collaborator isn't on Preem yet?",
    a: "Invite them by email or phone when you set up the split. They create a free account to claim their share — until they do, their cut is held safely, waiting for them.",
  },
];

export default function RoyaltySplitSheetPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">
          Music royalty split sheet tool for artists &amp; producers
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          A split sheet divides royalties between everyone who made a track —
          artists, featured artists, producers, writers. Preem&apos;s split
          sheet tool records each collaborator&apos;s share when you set up a
          drop and pays everyone their cut automatically on every sale, in
          naira, to their own bank account.
        </p>

        <h2 className="mb-3 mt-10 text-lg font-bold">
          How splits work on Preem
        </h2>
        <ol className="space-y-4">
          {[
            "Add a track to your drop and open the split panel.",
            "Invite each collaborator — featured artist, producer, whoever holds a stake — and assign their share. Shares must total 100%.",
            "Publish your drop. On every sale, Preem divides the payout automatically: each collaborator's cut lands in their own balance.",
            "Everyone gets paid out on the regular payout run, to their own Nigerian bank account — no manual transfers, no end-of-month arguments.",
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-paper/90 leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-10 text-lg font-bold">Questions artists ask</h2>
        <dl>
          {FAQ.map((item) => (
            <div key={item.q} className="mb-5">
              <dt className="mb-1.5 text-sm font-bold">{item.q}</dt>
              <dd className="text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-sm text-muted">
          Splits also apply per-track — different songs on one drop can have
          different splits.{" "}
          <Link href="/artist/signup" className="text-paper underline">
            Create a free artist account
          </Link>{" "}
          to set up your first split, or see{" "}
          <Link href="/help" className="text-paper underline">
            more artist questions
          </Link>
          .
        </p>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            }),
          }}
        />
      </main>
    </>
  );
}

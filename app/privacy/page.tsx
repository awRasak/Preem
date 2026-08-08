import type { Metadata } from "next";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Privacy Policy — Preem",
  description: "How Preem collects, uses, and shares your data.",
};

const h2 = "mt-10 mb-3 text-lg font-bold";
const p = "mb-4 text-[13.5px] leading-relaxed text-muted";
const ul = "mb-4 list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed text-muted";

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted">Last updated 8 August 2026</p>

        <p className={p}>
          This describes what Preem collects when you buy or sell music
          through the site, and what we do with it. Preem is
          Naira-native and Paystack-powered — most of what we collect exists
          to make a purchase and its streaming access work.
        </p>

        <h2 className={h2}>1. What we collect</h2>
        <p className={p}>
          <strong className="text-paper">If you&apos;re a fan</strong>,
          buying a drop, you give us your name, phone number, and email
          address at checkout. You don&apos;t create a password or account —
          your phone number is your identity on Preem, used to look up your
          purchases on My Drops.
        </p>
        <p className={p}>
          <strong className="text-paper">If you&apos;re an artist</strong>,
          you give us your email, stage name, profile info, and — once you
          request a payout — your bank account details, which we pass to
          Paystack to send transfers.
        </p>
        <p className={p}>
          We never see or store your card number. Card payments are handled
          entirely by Paystack.
        </p>

        <h2 className={h2}>2. How your phone number is used</h2>
        <p className={p}>
          After a successful purchase, entering the same phone number on My
          Drops sets a signed browser cookie that proves it&apos;s you,
          valid for 90 days, so you can come back and stream what you bought
          without re-entering it every time. The cookie only stores your
          phone number and an expiry — nothing else.
        </p>

        <h2 className={h2}>3. How we use this data</h2>
        <ul className={ul}>
          <li>To process payment and unlock streaming access to a drop.</li>
          <li>
            To let an artist see who bought their drops — name, phone
            number, and which track — in their dashboard&apos;s Listeners
            list, so they know their fanbase.
          </li>
          <li>To calculate and send weekly payouts to artists.</li>
          <li>To detect fraud and enforce these terms.</li>
          <li>
            To contact you about a purchase, a payout, or a change to Preem
            that affects you.
          </li>
        </ul>

        <h2 className={h2}>4. Who we share it with</h2>
        <ul className={ul}>
          <li>
            <strong className="text-paper">Paystack</strong> — processes
            payments and artist payouts, and receives what it needs to do
            so (amount, email, bank details for payouts).
          </li>
          <li>
            <strong className="text-paper">Supabase</strong> — hosts our
            database and file storage (audio files, artwork).
          </li>
          <li>
            <strong className="text-paper">The artist you buy from</strong> —
            sees your name and phone number as a &quot;listener&quot; on
            their dashboard, because that&apos;s who bought their music.
          </li>
        </ul>
        <p className={p}>
          We don&apos;t sell your data, and we don&apos;t share it with
          anyone else beyond what&apos;s needed to run Preem.
        </p>

        <h2 className={h2}>5. Data retention</h2>
        <p className={p}>
          We keep purchase records indefinitely, because they&apos;re what
          gives you permanent streaming access to what you bought. If you
          want your fan data (name, phone, email) deleted outside of active
          purchase records, contact us and we&apos;ll remove what we can
          while keeping what&apos;s required for financial recordkeeping.
        </p>

        <h2 className={h2}>6. Security</h2>
        <p className={p}>
          Audio files are served through short-lived signed URLs, not public
          links, so a track is only playable by someone who has actually
          purchased it (or the artist who owns it). Your phone-number session
          cookie is cryptographically signed so it can&apos;t be forged.
        </p>

        <h2 className={h2}>7. Your choices</h2>
        <p className={p}>
          You can stop a browser from recognizing you on My Drops at any
          time by clearing cookies — you&apos;ll just need to re-enter your
          phone number to see your purchases again. To ask what data we hold
          about a given phone number or email, or to request its deletion,
          contact us using the details below.
        </p>

        <h2 className={h2}>8. Changes</h2>
        <p className={p}>
          We may update this policy as Preem changes. Material changes will
          be reflected by updating the date at the top of this page.
        </p>

        <h2 className={h2}>9. Contact</h2>
        <p className={p}>
          Questions about your data? Reach us at{" "}
          <a href="mailto:support@preem.app" className="text-paper underline">
            support@preem.app
          </a>
          .
        </p>
      </main>
    </>
  );
}

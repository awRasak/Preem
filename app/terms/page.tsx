import type { Metadata } from "next";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Terms of Service — Preem",
  description: "The terms that govern buying and selling drops on Preem.",
};

const h2 = "mt-10 mb-3 text-lg font-bold";
const p = "mb-4 text-[13.5px] leading-relaxed text-muted";
const ul = "mb-4 list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed text-muted";

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-xs text-muted">Last updated 8 August 2026</p>

        <p className={p}>
          Preem is a direct-to-fan marketplace where artists sell early access
          to unreleased music straight to fans, priced in naira and paid for
          through Paystack. These terms cover everyone who uses Preem —
          artists who create drops and fans who buy them. By using the site
          you agree to them.
        </p>

        <h2 className={h2}>1. Accounts</h2>
        <p className={p}>
          Artists sign up for an account with an email and password to create
          and manage drops. Fans do not create accounts. A fan&apos;s
          identity on Preem is their phone number: it&apos;s collected at
          checkout and used afterward to look up and stream anything
          they&apos;ve bought, on the{" "}
          <a href="/fans" className="text-paper underline">
            My Music Collections
          </a>{" "}
          page. Keep the phone number you check out with — it&apos;s the only
          way to recover access if you switch devices.
        </p>

        <h2 className={h2}>2. Drops and purchases</h2>
        <p className={p}>
          A &quot;drop&quot; is a track an artist makes available for early
          purchase, usually for a limited window before it&apos;s released
          more widely elsewhere. Some drops are marked exclusive, meaning the
          artist won&apos;t release that track anywhere else.
        </p>
        <ul className={ul}>
          <li>
            Buying a drop gives permanent streaming access to that track on
            Preem — it doesn&apos;t expire when the drop&apos;s purchase
            window closes.
          </li>
          <li>
            Access is for streaming on Preem, not a download, unless the
            artist has explicitly enabled downloads for that track.
          </li>
          <li>
            Prices are set by the artist and shown in naira. Payment is
            processed by Paystack; Preem never sees or stores your card
            details.
          </li>
        </ul>

        <h2 className={h2}>3. No refunds</h2>
        <p className={p}>
          All sales are final once access has been granted. Because a
          purchase unlocks a digital file immediately, we don&apos;t offer
          refunds or exchanges for a change of mind. If a payment succeeded
          but you never got access — for example the track failed to unlock
          on My Music Collections — contact us and we&apos;ll investigate and fix it.
        </p>

        <h2 className={h2}>4. Payments and payouts (for artists)</h2>
        <p className={p}>
          Preem takes a 20% platform fee on each sale; the remaining 80% is
          owed to the artist. Earnings are paid out weekly to the bank
          account the artist has on file, via Paystack Transfers. Payouts
          depend on accurate bank details being entered in the artist
          dashboard — Preem isn&apos;t responsible for payouts sent to
          incorrect account details supplied by the artist.
        </p>

        <h2 className={h2}>5. What artists are responsible for</h2>
        <ul className={ul}>
          <li>
            You must own or control the rights to any track, artwork,
            lyrics, or collaborator credit you upload.
          </li>
          <li>
            You&apos;re responsible for the accuracy of what you publish,
            including any distribution or release-date claims shown to fans.
          </li>
          <li>
            New artist accounts are reviewed before drops go live. Preem may
            reject or remove a drop that infringes someone else&apos;s
            rights or violates these terms.
          </li>
        </ul>

        <h2 className={h2}>6. Prohibited use</h2>
        <p className={p}>
          Don&apos;t use Preem to upload content you don&apos;t have the
          rights to, to defraud fans or artists, to attempt to access another
          user&apos;s purchases or account, or to interfere with the
          platform&apos;s normal operation. We may suspend or terminate
          accounts that violate this.
        </p>

        <h2 className={h2}>7. Disclaimers</h2>
        <p className={p}>
          Preem is provided &quot;as is.&quot; We work to keep streaming
          access, checkout, and payouts reliable, but we don&apos;t guarantee
          uninterrupted availability and aren&apos;t liable for losses
          arising from outages, third-party payment failures, or content
          disputes between artists and fans.
        </p>

        <h2 className={h2}>8. Governing law</h2>
        <p className={p}>
          These terms are governed by the laws of the Federal Republic of
          Nigeria.
        </p>

        <h2 className={h2}>9. Changes</h2>
        <p className={p}>
          We may update these terms as Preem changes. Material changes will
          be reflected by updating the date at the top of this page.
        </p>

        <h2 className={h2}>10. Contact</h2>
        <p className={p}>
          Questions about these terms? Reach us at{" "}
          <a href="mailto:support@preem.app" className="text-paper underline">
            support@preem.app
          </a>
          .
        </p>
      </main>
    </>
  );
}

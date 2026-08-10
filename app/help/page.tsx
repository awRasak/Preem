import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Help — Preem",
  description: "Answers to common questions about buying and selling on Preem.",
};

const h2 = "mt-10 mb-4 text-lg font-bold";
const q = "mb-1.5 text-[14px] font-bold";
const a = "mb-5 text-[13.5px] leading-relaxed text-muted";

export default function HelpPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10 sm:px-8">
        <h1 className="text-2xl font-bold">Help</h1>
        <p className="mt-2 text-[13.5px] text-muted">
          Common questions from fans and artists. Can&apos;t find your
          answer? Email{" "}
          <a href="mailto:support@preem.app" className="text-paper underline">
            support@preem.app
          </a>
          .
        </p>

        <h2 className={h2}>For fans</h2>

        <p className={q}>How do I buy a drop?</p>
        <p className={a}>
          Open a track from the homepage and tap Buy access. Enter your name,
          phone number, and email, then pay with Paystack — card, bank
          transfer, or USSD. As soon as payment confirms, you have permanent
          streaming access to that track.
        </p>

        <p className={q}>How do I listen to what I&apos;ve bought?</p>
        <p className={a}>
          Go to{" "}
          <Link href="/fans" className="text-paper underline">
            My Music Collections
          </Link>{" "}
          and enter the phone number you checked out with. You&apos;ll see
          everything you&apos;ve bought and can stream it from there —
          bookmark the page or remember your number, since there&apos;s no
          password.
        </p>

        <p className={q}>Can I download the tracks I buy?</p>
        <p className={a}>
          By default, purchases are streaming-only through My Music
          Collections. Some
          artists enable downloads for their own tracks from their
          dashboard; if that&apos;s on, you&apos;ll see a download option
          next to the track.
        </p>

        <p className={q}>Can I get a refund?</p>
        <p className={a}>
          No — all sales are final once access is granted, since a purchase
          unlocks the track immediately. If you paid but never got access,
          email us and we&apos;ll sort it out.
        </p>

        <p className={q}>What does &quot;exclusive&quot; mean on a drop?</p>
        <p className={a}>
          An exclusive drop won&apos;t be released anywhere else — Preem is
          the only place to ever get that track. Non-exclusive drops are
          just early access before a wider release elsewhere; buying still
          gives you permanent access on Preem even after that window closes.
        </p>

        <h2 className={h2}>For artists</h2>

        <p className={q}>How do I start selling drops?</p>
        <p className={a}>
          <Link href="/artist/signup" className="text-paper underline">
            Sign up
          </Link>{" "}
          with your email and stage name. New accounts go through a quick
          review before your drops go live.
        </p>

        <p className={q}>How much does Preem take?</p>
        <p className={a}>
          Preem takes a 20% platform fee on each sale. You keep 80%.
        </p>

        <p className={q}>When and how do I get paid?</p>
        <p className={a}>
          Payouts run weekly to the bank account on file in your dashboard,
          sent via Paystack Transfers. Make sure your bank details are
          entered and correct before payout day.
        </p>

        <p className={q}>Who can see my listeners?</p>
        <p className={a}>
          Only you. Your dashboard shows the name and phone number of
          everyone who&apos;s bought each of your drops, so you know your
          fanbase — that data isn&apos;t shared with other artists.
        </p>

        <h2 className={h2}>Payments</h2>

        <p className={q}>What payment methods are supported?</p>
        <p className={a}>
          Anything Paystack supports — cards, bank transfer, and USSD, all
          in naira.
        </p>

        <p className={q}>Is my card information safe?</p>
        <p className={a}>
          Yes. Paystack handles your card details directly — Preem never
          sees or stores your card number.
        </p>
      </main>
    </>
  );
}

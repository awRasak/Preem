import Image from "next/image";
import Link from "next/link";
import { Nav, NavLink } from "@/components/Nav";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { DropCard } from "@/components/DropCard";
import { FeatureCarousel } from "@/components/FeatureCarousel";
import { HowItWorksSteps } from "@/components/HowItWorksSteps";
import { MarqueeTicker } from "@/components/MarqueeTicker";
import { ArtistSpotlight } from "@/components/ArtistSpotlight";
import { PaymentTrustRow } from "@/components/PaymentTrustRow";
import { FilmstripGallery } from "@/components/FilmstripGallery";
import { HomeFAQ } from "@/components/HomeFAQ";
import { createClient } from "@/lib/supabase/server";
import { artworkFallback } from "@/lib/placeholder";
import type { Drop } from "@/lib/types";

export const revalidate = 0;

export default async function MarketplacePage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("drops")
    .select("*, artist:artists(id, stage_name, avatar_url, approval_status)")
    .eq("status", "published")
    .or(`window_end.is.null,window_end.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  const drops = ((data ?? []) as (Drop & {
    artist: {
      id: string;
      stage_name: string;
      avatar_url: string | null;
      approval_status: string;
    } | null;
  })[]).filter((d) => d.artist?.approval_status === "approved");

  const previewDrops = drops.slice(0, 8);
  const filmstripDrops = drops.slice(0, 10);

  return (
    <>
      <Nav>
        <NavLink href="/explore">Explore</NavLink>
        <NavLink href="/artist/signup">For artists</NavLink>
        <Button href="/artist/login" variant="outline">
          Sign in
        </Button>
      </Nav>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-8 sm:px-8 sm:pb-8">
        {/* Hero */}
        <section className="relative px-6 py-16 text-center sm:py-24">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="hero-video-fade absolute inset-0 h-full w-full object-cover"
          >
            <source src="/video/hero-loop.mp4" type="video/mp4" />
          </video>
          <div className="relative mx-auto max-w-lg">
            <div className="mb-4 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live — {drops.length} drop{drops.length === 1 ? "" : "s"} open now
            </div>
            <h1 className="text-6xl font-bold leading-none tracking-tight sm:text-8xl">
              Live off
              <br />
              your music.
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm text-muted sm:text-base">
              Sell early access to your next drop straight to your fans —
              priced in naira, paid out to your account, no card ever
              bounces.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button href="/artist/signup" variant="primary">
                Start a drop
              </Button>
              <Button href="#how-it-works" variant="outline">
                See how it works
              </Button>
            </div>
          </div>
        </section>

        {/* Live drops */}
        <div className="mb-6 mt-24 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Live drops</h2>
          <Link
            href="/explore"
            className="text-xs font-bold text-accent underline"
          >
            Explore all drops →
          </Link>
        </div>
        {previewDrops.length === 0 ? (
          <p className="text-sm text-muted">
            Nothing live yet — check back soon.
          </p>
        ) : (
          <div className="scroll-fade-x no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 pt-2 sm:-mx-8 sm:px-8">
            {previewDrops.map((drop) => (
              <div
                key={drop.id}
                className="w-[70%] flex-shrink-0 min-[640px]:w-[calc((100%-1rem)/2)] min-[700px]:w-[calc((100%-2rem)/3)] min-[1244px]:w-[calc((100%-3rem)/4)]"
              >
                <DropCard drop={drop} />
              </div>
            ))}
          </div>
        )}

        {/* Feature carousel */}
        <div className="mt-24">
          <FeatureCarousel />
        </div>

        {/* Why Preem exists */}
        <section className="mt-32 grid items-center gap-10 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
              Why Preem exists
            </p>
            <h2 className="mb-5 max-w-lg text-2xl font-bold leading-tight sm:text-3xl">
              Your fans want to support you directly. Most platforms won&apos;t let
              them.
            </h2>
            <div className="max-w-2xl space-y-4 text-sm text-muted">
              <p>
                Streaming pays a fraction of what your music is actually worth to
                the people who love it most. And the platforms built to fix that —
                sell directly, get paid daily, keep the relationship — weren&apos;t
                built for artists paying and getting paid in naira. Cards decline.
                Currencies aren&apos;t supported. Fans give up before they ever get
                to send you money.
              </p>
              <p>
                Preem is built the other way around: naira first, your fans&apos;
                actual payment methods first — card, bank transfer, USSD — so the
                sale that should&apos;ve happened, happens.
              </p>
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-[380px]">
            <Image
              src="/icons/why-preem-exists.png"
              alt=""
              fill
              className="object-contain"
              sizes="380px"
            />
          </div>
        </section>

        {/* Marquee ticker — full-bleed via negative margins, breaks out of this max-w container */}
        <div className="mt-32">
          <MarqueeTicker />
        </div>

        {/* How it works */}
        <section id="how-it-works" className="mt-32 scroll-mt-20">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
            How it works
          </p>
          <h2 className="mb-8 max-w-lg text-2xl font-bold leading-tight sm:text-3xl">
            Three steps. First sale can happen today.
          </h2>
          <HowItWorksSteps />
        </section>

        {/* Pay What You Want split */}
        <section className="mt-32 grid items-center gap-10 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
              How pricing works
            </p>
            <h2 className="mb-5 text-2xl font-bold leading-tight sm:text-3xl">
              You set the floor. Fans decide how much you&apos;re worth to
              them.
            </h2>
            <p className="mb-4 text-sm text-muted">
              Every drop has a minimum price — never zero, never a fixed
              ceiling. A fan can pay exactly what you asked, or more, if they
              want to show up harder for you. You keep 80% of whatever comes
              in. No hidden fees stacked on top, no surprise deductions
              before payout.
            </p>
            <p className="mb-5 text-sm text-muted/80">
              Preem takes a 20% platform fee per sale. That&apos;s it.
            </p>
            <PaymentTrustRow align="start" />
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-full border border-line-strong">
            <Image
              src={artworkFallback("pricing-split")}
              alt=""
              fill
              className="object-cover"
              sizes="320px"
            />
          </div>
        </section>

        {/* Live vs Exclusive — two full-width stacked sections */}
        <section className="mt-32">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
            Two ways to drop
          </p>
          <h2 className="mb-8 max-w-lg text-2xl font-bold leading-tight sm:text-3xl">
            Pick what fits the release.
          </h2>
          <div className="card-inset-glow relative h-[420px] overflow-hidden rounded-2xl border border-line bg-card p-5 sm:h-[260px] sm:p-8">
            <Badge status="live">LIVE</Badge>
            <p className="mt-3 max-w-[220px] text-lg font-bold sm:max-w-[260px]">
              For music that&apos;s headed everywhere, eventually.
            </p>
            <p className="mt-2 text-sm text-muted sm:max-w-sm">
              Give your community first access before the track hits
              Spotify, Audiomack, or wherever you release next. Pick the
              date. Preem counts down for your fans, and reminds you when
              it&apos;s time to go public.
            </p>
            <div className="pointer-events-none absolute bottom-0 left-1/2 w-[286px] -translate-x-1/2 sm:left-auto sm:right-0 sm:w-[380px] sm:translate-x-0">
              <Image
                src="/icons/live-card.png"
                alt=""
                width={1191}
                height={709}
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="card-inset-glow relative h-[420px] overflow-hidden rounded-2xl border border-line bg-card p-5 sm:h-[260px] sm:p-8">
            <Badge status="exclusive">EXCLUSIVE</Badge>
            <p className="mt-3 max-w-md text-lg font-bold">
              For music that only exists here.
            </p>
            <p className="mt-2 text-sm text-muted sm:max-w-md">
              No release date, no countdown, no other platform — ever. This
              is the drop for your realest supporters: something that will
              never exist anywhere but the place they bought it from you
              directly.
            </p>
            <div className="pointer-events-none absolute bottom-0 left-1/2 w-[286px] -translate-x-1/2 sm:left-auto sm:right-0 sm:w-[380px] sm:translate-x-0">
              <Image
                src="/icons/exclusive-card.png"
                alt=""
                width={1135}
                height={552}
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        {/* Trust split */}
        <section className="mt-32 grid items-center gap-10 sm:grid-cols-2">
          <div className="relative order-2 mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-full border border-line-strong sm:order-1">
            <Image
              src={artworkFallback("trust-split")}
              alt=""
              fill
              className="object-cover"
              sizes="320px"
            />
          </div>
          <div className="order-1 sm:order-2">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
              Built differently
            </p>
            <h2 className="mb-5 text-2xl font-bold leading-tight sm:text-3xl">
              Why this works for you specifically.
            </h2>
            <ul className="space-y-4 text-sm text-muted">
              <li>
                <strong className="text-paper">Naira-native.</strong> Card,
                bank transfer, USSD — not a foreign checkout that quietly
                assumes a different economy.
              </li>
              <li>
                <strong className="text-paper">Paid weekly, directly.</strong>{" "}
                No waiting on a distributor&apos;s royalty cycle.
              </li>
              <li>
                <strong className="text-paper">Your data, your fans.</strong>{" "}
                Every buyer is a real contact — not a stream count
                you&apos;ll never see again.
              </li>
            </ul>
          </div>
        </section>

        {/* Artist spotlight */}
        <section className="mt-32">
          <ArtistSpotlight />
        </section>

        {/* Filmstrip gallery — full-bleed via negative margins */}
        <div className="mt-32">
          <FilmstripGallery drops={filmstripDrops} />
        </div>

        {/* FAQ */}
        <section className="mt-32">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-accent">
            Questions
          </p>
          <h2 className="mb-8 max-w-lg text-2xl font-bold leading-tight sm:text-3xl">
            Everything you need to know.
          </h2>
          <HomeFAQ />
        </section>

        {/* Final CTA */}
        <section className="card-inset-glow mt-32 rounded-[20px] border border-line bg-card p-8 text-center sm:p-11">
          <h2 className="mx-auto max-w-md text-2xl font-bold leading-tight sm:text-3xl">
            Your next drop could be live in the next ten minutes.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
            Upload a track, set your price, share the link. That&apos;s the
            whole thing.
          </p>
          <Button href="/artist/signup" variant="primary" className="mt-5">
            Start a drop
          </Button>
        </section>

        {/* Footer */}
        <footer className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-line pb-10 pt-8 text-xs text-muted">
          <Link href="/explore" className="hover:text-paper">
            Explore
          </Link>
          <Link href="/artist/signup" className="hover:text-paper">
            For Artists
          </Link>
          <Link href="/artist/login" className="hover:text-paper">
            Sign In
          </Link>
          <Link href="/terms" className="hover:text-paper">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-paper">
            Privacy
          </Link>
          <Link href="/help" className="hover:text-paper">
            Help
          </Link>
        </footer>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-4 backdrop-blur sm:hidden">
        <Button href="/artist/login" variant="primary" className="w-full">
          Sign in
        </Button>
        <Link
          href="/my-drops"
          className="mt-2 block text-center text-xs text-muted underline"
        >
          Sign in as a fan instead
        </Link>
      </div>
    </>
  );
}

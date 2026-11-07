import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline";

type CommonProps = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = CommonProps & {
  href: string;
};

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-3 text-sm font-bold font-plakat transition-all duration-150 ease-out hover:opacity-90 hover:scale-[1.03] active:scale-95 active:opacity-100 disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-[#1a0d05]",
  outline: "bg-transparent border-[1.5px] border-line-strong text-paper",
};

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant = "primary", children, className = "" } = props;
  const cls = `${base} ${variants[variant]} ${className}`;

  if ("href" in props && props.href) {
    // Same-page hash links must be plain anchors, not next/link. The App
    // Router treats a hash as a navigation and bails when the URL already
    // carries that hash, so once the visitor has clicked "See how it works"
    // (or arrived on /#how-it-works), scrolling away and clicking again does
    // nothing. A native <a> re-scrolls to the fragment on every click.
    if (props.href.startsWith("#")) {
      return (
        <a href={props.href} className={cls}>
          {children}
        </a>
      );
    }
    return (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { href: _href, ...buttonProps } = props as ButtonAsButton;
  return (
    <button {...buttonProps} className={cls}>
      {children}
    </button>
  );
}

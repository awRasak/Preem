import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function TwitterIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.5 4.5l15 15M19.5 4.5l-15 15"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth={2} />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth={2} />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M13.5 21v-7.5h2.4l.4-3H13.5V8.6c0-.9.2-1.5 1.6-1.5H16V4.4C15.7 4.3 14.7 4 13.6 4 11.3 4 9.7 5.4 9.7 8.1v2.4H7.2v3h2.5V21h3.8z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TiktokIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M14.1 3h2.4c.15 1.35.9 2.5 2.15 3.1.6.3 1.25.45 1.85.45v2.55a6.6 6.6 0 0 1-4-1.35v6.7a5.35 5.35 0 1 1-4.6-5.3v2.6a2.75 2.75 0 1 0 2 2.65V3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SnapchatIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 3.2c-2.9 0-4.85 2.15-4.85 5.1 0 .85.09 1.55.2 2.1-.65.35-1.55.55-2.05.65-.4.08-.55.6-.25.9.5.5 1.3 1 1.9 1.25-.1.3-.3.65-.65.95-.3.25-.1.7.3.75.95.1 1.6.5 2 1 .5.6 1.6 1.65 3.4 1.65s2.9-1.05 3.4-1.65c.4-.5 1.05-.9 2-1 .4-.05.6-.5.3-.75-.35-.3-.55-.65-.65-.95.6-.25 1.4-.75 1.9-1.25.3-.3.15-.82-.25-.9-.5-.1-1.4-.3-2.05-.65.11-.55.2-1.25.2-2.1 0-2.95-1.95-5.1-4.85-5.1z"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="6" y="4.5" width="4.5" height="15" rx="1" fill="currentColor" />
      <rect x="13.5" y="4.5" width="4.5" height="15" rx="1" fill="currentColor" />
    </svg>
  );
}

export function PreviousTrackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="4.5" y="5" width="2.2" height="14" rx="1" fill="currentColor" />
      <path d="M18.5 5.5v13L8 12l10.5-6.5z" fill="currentColor" />
    </svg>
  );
}

export function NextTrackIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect x="17.3" y="5" width="2.2" height="14" rx="1" fill="currentColor" />
      <path d="M5.5 5.5v13L16 12 5.5 5.5z" fill="currentColor" />
    </svg>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 6.5h3.3c1.15 0 2.2.6 2.8 1.6l4.8 7.8c.6 1 1.65 1.6 2.8 1.6H21"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 4.3l3.5 2.7-3.5 2.7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 17.5h3.3c1.15 0 2.2-.6 2.8-1.6l.9-1.5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 19.7l3.5-2.7-3.5-2.7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RepeatIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M17.5 2.5l3.3 3.3-3.3 3.3"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.3V9.8a4 4 0 0 1 4-4h13.8"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 21.5l-3.3-3.3 3.3-3.3"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 12.7v1.5a4 4 0 0 1-4 4H3.2"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M12 3v11.5m0 0l-4-4m4 4l4-4"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 16.5V18a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-1.5"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GiftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <rect
        x="3.5"
        y="9"
        width="17"
        height="4"
        rx="0.75"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M5 13h14v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V13z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path d="M12 9v12" stroke="currentColor" strokeWidth={1.8} />
      <path
        d="M12 9C12 9 9.5 4.5 7 4.5A2.25 2.25 0 0 0 7 9h5z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <path
        d="M12 9c0 0 2.5-4.5 5-4.5a2.25 2.25 0 0 1 0 4.5h-5z"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </svg>
  );
}

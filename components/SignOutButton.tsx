"use client";

import { useState, type ReactNode } from "react";

export function SignOutButton({
  className = "rounded-full border border-line-strong px-3.5 py-1.5 text-center text-[13px] text-muted transition-all duration-150 ease-out hover:scale-[1.04] hover:border-line-strong hover:bg-surface-2 hover:text-paper active:scale-95",
  children = "Sign out",
  redirectTo = "/",
}: {
  className?: string;
  children?: ReactNode;
  redirectTo?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/auth/signout", { method: "POST" });
    // A client-side route change would keep reading the router's cached
    // payload/session state from before sign-out -- a full navigation
    // guarantees every server component re-reads the now-cleared session.
    window.location.href = redirectTo;
  }

  return (
    <button type="button" onClick={handleClick} disabled={loading} className={className}>
      {loading ? "…" : children}
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CurrentRole = "admin" | "artist" | "fan" | null;

// The whole page's PreviewButtons share one role lookup instead of each
// firing its own auth + role query on mount. Cleared on any auth change so
// sign-in/sign-out (or a switch between accounts) re-resolves it.
let cachedRole: Promise<CurrentRole> | null = null;

function loadRole(): Promise<CurrentRole> {
  if (!cachedRole) {
    cachedRole = (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return null;
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        return (roleRow?.role as CurrentRole) ?? null;
      } catch {
        return null;
      }
    })();
  }
  return cachedRole;
}

export function useCurrentRole(): { role: CurrentRole; loading: boolean } {
  const [role, setRole] = useState<CurrentRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const resolve = () => {
      loadRole().then((r) => {
        if (cancelled) return;
        setRole(r);
        setLoading(false);
      });
    };
    resolve();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      cachedRole = null;
      if (!cancelled) {
        setRole(null);
        setLoading(true);
      }
      resolve();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { role, loading };
}
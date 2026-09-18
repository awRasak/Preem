"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CurrentRole = "admin" | "artist" | "fan" | null;

type RoleListener = (role: CurrentRole) => void;

// The whole page's PreviewButtons share ONE auth + role lookup. A module-level
// promise dedupes the in-flight fetch so N mounts never fan out N requests;
// a singleton auth listener (not one per hook) invalidates it only when the
// signed-in user actually changes. Cleared on sign-in/sign-out/account switch.
let generation = 0;
let cachedRole: Promise<CurrentRole> | null = null;
let settled = false;
let settledRole: CurrentRole = null;
let settledUserId: string | null = null;
const listeners = new Set<RoleListener>();

function commit(gen: number, role: CurrentRole, userId: string | null) {
  if (gen !== generation) return;
  settled = true;
  settledRole = role;
  settledUserId = userId;
  listeners.forEach((listener) => listener(role));
}

function loadRole(): Promise<CurrentRole> {
  if (!cachedRole) {
    const gen = generation;
    cachedRole = (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          commit(gen, null, null);
          return null;
        }
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        const role = (roleRow?.role as CurrentRole) ?? null;
        commit(gen, role, user.id);
        return role;
      } catch {
        commit(gen, null, null);
        return null;
      }
    })();
  }
  return cachedRole;
}

let listenerAttached = false;

function attachAuthListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  let initialUserSeen = false;
  let initialUserId: string | null = null;
  const supabase = createClient();
  supabase.auth.onAuthStateChange((event, session) => {
    // While a session exists, subscribing emits two attach-time callbacks
    // (INITIAL_SESSION, then SIGNED_IN) as a snapshot. The mount that attached
    // us already kicked off loadRole(), so swallow that snapshot and any event
    // still matching it while the lookup is racing: only a real later change —
    // a different user or a sign-out — invalidates the cache and refetches.
    // Same-user refreshes (TOKEN_REFRESHED) keep the settled role.
    if (event === "INITIAL_SESSION") return;
    const eventUserId = session?.user?.id ?? null;
    if (!initialUserSeen) {
      initialUserSeen = true;
      initialUserId = eventUserId;
      return;
    }
    if (settled && eventUserId === settledUserId) return;
    if (!settled && eventUserId === initialUserId) return;
    generation += 1;
    cachedRole = null;
    loadRole();
  });
}

export function useCurrentRole(): { role: CurrentRole; loading: boolean } {
  const [role, setRole] = useState<CurrentRole>(settled ? settledRole : null);
  const [loading, setLoading] = useState(!settled);

  useEffect(() => {
    attachAuthListener();
    const update = (next: CurrentRole) => {
      setRole(next);
      setLoading(false);
    };
    listeners.add(update);
    if (settled) update(settledRole);
    loadRole();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return { role, loading };
}
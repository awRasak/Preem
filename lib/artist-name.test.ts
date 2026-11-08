import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isArtistNameTaken } from "./artist-name";

// The helper makes one or two sequential lookups: slug first (when the name
// produces one), then the exact trimmed name. This fake answers each `from`
// call in order with the rows supplied.
function fakeSupabase(...lookups: unknown[][]) {
  let call = 0;
  const from = vi.fn(() => {
    const rows = lookups[call++] ?? [];
    const limit = vi.fn().mockResolvedValue({ data: rows });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    return { select };
  });
  return { from } as unknown as SupabaseClient;
}

describe("isArtistNameTaken", () => {
  it("rejects a name whose slug is already used", async () => {
    const supabase = fakeSupabase([{ id: "existing" }]);
    await expect(isArtistNameTaken(supabase, "Genz Gemzy")).resolves.toBe(true);
  });

  it("rejects punctuation/case variants that share a slug", async () => {
    const supabase = fakeSupabase([{ id: "existing" }]);
    await expect(isArtistNameTaken(supabase, "GENZ-GEMZY")).resolves.toBe(true);
  });

  it("falls back to the exact name when the slug is empty", async () => {
    const supabase = fakeSupabase([{ id: "existing" }]);
    await expect(isArtistNameTaken(supabase, "🔥")).resolves.toBe(true);
  });

  it("allows a name nobody uses", async () => {
    const supabase = fakeSupabase([], []);
    await expect(isArtistNameTaken(supabase, "Odara")).resolves.toBe(false);
    // slug lookup + name lookup
    expect((supabase.from as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });
});

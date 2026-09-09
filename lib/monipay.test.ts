import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTransferRecipient,
  initializeTransaction,
  initiateTransfer,
  monipayCandidateRefs,
  verifyTransaction,
} from "./monipay";

// Regression coverage for two real production incidents in one session:
// 1. /transaction/initialize was never called at all, so our own reference
//    was never registered with Monipay and verify always 404'd.
// 2. Once that call was added, it turned out to need the *public* key for
//    auth, not the secret key like every other endpoint -- confirmed
//    directly against Monipay's live API error message.
// These tests pin both behaviors so neither regresses silently.

const SECRET = "pri_live_test_secret";
const PUBLIC = "pub_live_test_public";

function mockFetchOnce(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 401,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function authHeader(fetchMock: ReturnType<typeof vi.fn>): string {
  const [, init] = fetchMock.mock.calls[0];
  return (init.headers as Record<string, string>).Authorization;
}

describe("monipay auth key selection", () => {
  beforeEach(() => {
    vi.stubEnv("MONIPAY_SECRET_KEY", SECRET);
    vi.stubEnv("NEXT_PUBLIC_MONIPAY_PUBLIC_KEY", PUBLIC);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("initializeTransaction authenticates with the public key", async () => {
    const fetchMock = mockFetchOnce({
      status: true,
      data: { authorization_url: "https://x", access_code: "ac_1", reference: "ref_1" },
    });
    await initializeTransaction({ email: "a@b.com", amountKobo: 1000, reference: "ref_1" });
    expect(authHeader(fetchMock)).toBe(`Bearer ${PUBLIC}`);
  });

  it("verifyTransaction authenticates with the secret key", async () => {
    const fetchMock = mockFetchOnce({
      status: true,
      data: { status: "success", amount: 1000, reference: "ref_1", metadata: {} },
    });
    await verifyTransaction("ref_1");
    expect(authHeader(fetchMock)).toBe(`Bearer ${SECRET}`);
  });

  it("createTransferRecipient authenticates with the secret key", async () => {
    const fetchMock = mockFetchOnce({ status: true, data: { recipient_code: "rc_1" } });
    await createTransferRecipient({ name: "Artist", accountNumber: "0000000000", bankCode: "058" });
    expect(authHeader(fetchMock)).toBe(`Bearer ${SECRET}`);
  });

  it("initiateTransfer authenticates with the secret key", async () => {
    const fetchMock = mockFetchOnce({ status: true, data: { transfer_code: "tc_1", status: "success" } });
    await initiateTransfer({ amountKobo: 1000, recipientCode: "rc_1", reason: "payout", reference: "tr_1" });
    expect(authHeader(fetchMock)).toBe(`Bearer ${SECRET}`);
  });

  it("initializeTransaction registers the caller's own reference, not an auto-generated one", async () => {
    const fetchMock = mockFetchOnce({
      status: true,
      data: { authorization_url: "https://x", access_code: "ac_1", reference: "preem_abc123" },
    });
    await initializeTransaction({ email: "a@b.com", amountKobo: 1000, reference: "preem_abc123" });
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.reference).toBe("preem_abc123");
  });

  it("surfaces Monipay's real error message on failure instead of a generic one", async () => {
    mockFetchOnce(
      { status: false, message: "Use public key for this endpoint. Do not use private key (pri_live_* or pri_demo_*)." },
      false,
    );
    await expect(
      initializeTransaction({ email: "a@b.com", amountKobo: 1000, reference: "ref_1" }),
    ).rejects.toThrow(/Use public key for this endpoint/);
  });
});

describe("monipayCandidateRefs", () => {
  // The inline popup drops our reference, so confirmation depends on
  // extracting Monipay's own reference from its undocumented postMessage
  // payload -- these pin the extraction against every shape we've seen.
  it("returns nothing for null/undefined/numbers", () => {
    expect(monipayCandidateRefs(null)).toEqual([]);
    expect(monipayCandidateRefs(undefined)).toEqual([]);
    expect(monipayCandidateRefs(42)).toEqual([]);
  });

  it("accepts a bare string reference", () => {
    expect(monipayCandidateRefs("mp_abc123")).toEqual(["mp_abc123"]);
  });

  it("reads common reference fields off the payload", () => {
    expect(monipayCandidateRefs({ reference: "mp_1" })).toEqual(["mp_1"]);
    expect(monipayCandidateRefs({ trxref: "mp_2" })).toEqual(["mp_2"]);
    expect(
      monipayCandidateRefs({ transaction_reference: "mp_3" }),
    ).toEqual(["mp_3"]);
  });

  it("reads one nested data level and dedupes", () => {
    expect(
      monipayCandidateRefs({
        status: "success",
        data: { reference: "mp_4", id: "mp_4" },
      }),
    ).toEqual(["mp_4"]);
  });

  it("skips non-strings and stubs", () => {
    expect(
      monipayCandidateRefs({ reference: 123, id: "ab", reference2: "mp_5" }),
    ).toEqual([]);
  });
});

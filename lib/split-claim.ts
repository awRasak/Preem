import { createHmac, timingSafeEqual } from "node:crypto";

// Claim links for off-Preem contributors: proves the invite id + email the
// owner invited, without a token table. No expiry -- money held for a
// pending invite stays claimable (revoking the invite kills the token).
export function createSplitClaimToken(inviteId: string, email: string): string {
  const encoded = Buffer.from(
    JSON.stringify({ inviteId, email: email.toLowerCase() }),
  ).toString("base64url");
  const sig = createHmac("sha256", process.env.PHONE_SESSION_SECRET!)
    .update(encoded)
    .digest("hex");
  return `${encoded}.${sig}`;
}

export function verifySplitClaimToken(
  token: string | undefined,
): { inviteId: string; email: string } | null {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", process.env.PHONE_SESSION_SECRET!)
    .update(encoded)
    .digest("hex");
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }
  try {
    const { inviteId, email } = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (!inviteId || !email) return null;
    return { inviteId: String(inviteId), email: String(email) };
  } catch {
    return null;
  }
}

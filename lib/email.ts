import { Resend } from "resend";
import { formatNaira } from "@/lib/format";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Resend's shared sandbox sender (onboarding@resend.dev) only delivers to the
// Resend account's own address until a sending domain is verified — swap in
// a verified address (e.g. receipts@preem.ng) via RECEIPT_FROM_EMAIL once one exists.
const FROM = process.env.RECEIPT_FROM_EMAIL ?? "Preem <onboarding@resend.dev>";

export async function sendReceiptEmail({
  to,
  fanName,
  dropTitle,
  artistName,
  amountKobo,
  reference,
}: {
  to: string;
  fanName: string;
  dropTitle: string;
  artistName: string;
  amountKobo: number;
  reference: string;
}) {
  if (!resend) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://preem.ng";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your receipt for "${dropTitle}"`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">Thanks, ${fanName}!</h2>
        <p style="color: #555;">You now have permanent streaming access to <strong>${dropTitle}</strong>${artistName ? ` by ${artistName}` : ""}.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Amount paid</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatNaira(amountKobo)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #777;">Reference</td>
            <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 12px;">${reference}</td>
          </tr>
        </table>
        <p style="color: #555;">
          Stream it anytime at
          <a href="${appUrl}/fans" style="color: #1a1a1a;">My Music Collections</a>
          — enter the phone number you checked out with.
        </p>
        <p style="color: #aaa; font-size: 12px; margin-top: 32px;">No refunds once access is granted. Questions? Reply to this email.</p>
      </div>
    `,
  });
}

export async function sendNewArtistSignupEmail({
  to,
  stageName,
  email,
  profileLink,
}: {
  to: string[];
  stageName: string;
  email: string;
  profileLink: string | null;
}) {
  if (!resend || to.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://preem.ng";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `New artist signup: ${stageName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 4px;">New artist waiting for approval</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Stage name</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${stageName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #777;">Email</td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #777;">Profile link</td>
            <td style="padding: 8px 0; text-align: right;">${profileLink ?? "— none —"}</td>
          </tr>
        </table>
        <p style="color: #555;">
          Review it in the <a href="${appUrl}/admin" style="color: #1a1a1a;">admin dashboard</a>.
        </p>
      </div>
    `,
  });
}

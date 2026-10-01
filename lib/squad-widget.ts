"use client";

import { loadScript } from "./load-script";

const SQUAD_SCRIPT = "https://checkout.squadco.com/widget/squad.min.js";

// Squad's widget: `new squad({...}); instance.setup(); instance.open();`
// (it also exposes `window.Squad`). Everything in the config object is
// forwarded verbatim to the popup over postMessage, so the keys are the
// documented init parameters.
type SquadWidget = {
  setup: () => void;
  open: () => void;
};

type SquadCtor = new (options: {
  key: string;
  email: string;
  amount: number;
  currency_code?: string;
  transaction_ref?: string;
  customer_name?: string;
  payment_channels?: string[];
  callback_url?: string;
  onSuccess: (data: unknown) => void;
  onClose: () => void;
  onLoad?: () => void;
}) => SquadWidget;

declare global {
  interface Window {
    squad?: SquadCtor;
  }
}

export type SquadCheckoutOptions = {
  // Publishable key from the initialize route (squad branch).
  publicKey: string | undefined;
  email: string;
  amountKobo: number;
  // Our own reference. The widget registers the transaction under it, so the
  // server must NOT pre-initiate the same one -- same rule as Monipay (see
  // the NOTE in app/api/checkout/initialize/route.ts).
  reference: string;
  customerName?: string;
  onSuccess: () => void;
  onClose: () => void;
};

// Injected at pay time like the other SDKs (see lib/load-script.ts). Throws
// when the SDK fails to arrive so the caller can drop back to the form.
export async function openSquadCheckout(options: SquadCheckoutOptions): Promise<void> {
  await loadScript(SQUAD_SCRIPT);
  const Squad = window.squad;
  if (!Squad) {
    throw new Error("Squad widget did not load");
  }

  const widget = new Squad({
    key: options.publicKey ?? "",
    email: options.email,
    amount: options.amountKobo,
    // Charging and settlement stay in naira for every gateway here --
    // same pin the Paystack popups use.
    currency_code: "NGN",
    transaction_ref: options.reference,
    customer_name: options.customerName,
    onSuccess: () => options.onSuccess(),
    onClose: () => options.onClose(),
  });
  widget.setup();
  widget.open();
}

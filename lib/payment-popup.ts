"use client";

import { loadScript } from "./load-script";
import { openSquadCheckout } from "./squad-widget";
import {
  dismissNewestMonipayPopup,
  isMonipayPopupOpen,
  monipayPopupErrorMessage,
} from "./monipay";

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref: string;
        onClose?: () => void;
        callback?: (transaction: { reference: string }) => void;
      }) => { openIframe: () => void };
    };
    Monipay: new () => {
      checkout: (options: {
        key: string;
        email: string;
        amount: number;
        // Our reference travels via `metadata` (the v2 inline script merges
        // it as extra /popup query keys) and the popup creates the order
        // under it -- so the server must NOT pre-register the same
        // reference.
        metadata?: Record<string, string>;
        onLoad?: () => void;
        onSuccess?: (data: unknown) => void;
        onCancel?: () => void;
        onError?: (error: unknown) => void;
      }) => void;
    };
  }
}

export type PaymentGateway = "monipay" | "squad" | "paystack";

export type PaymentLaunchParams = {
  // Server-chosen gateway (geo-routed) + reference from the initialize
  // route -- the client never picks either.
  gateway: PaymentGateway;
  reference: string;
  amountKobo: number;
  publicKey: string;
  email: string;
  customerName?: string;
};

export type PaymentCallbacks = {
  // Payment completed at the gateway. `payload` carries Monipay's success
  // object (needed by verify-monipay); other gateways pass just our ref.
  onSuccess: (reference: string, payload?: unknown) => void;
  // Popup dismissed without completing -- safe to re-enable the pay button.
  onCancel: () => void;
  // SDK failed to load, or the gateway reported an error (message ready to
  // show, including the Monipay "rescued popup" case).
  onError: (message: string) => void;
};

const LOAD_FAILED = "Payment failed to load — try again.";
const STILL_LOADING = "Payment popup is still loading — try again in a second.";

// Dispatches to the right gateway popup and funnels every outcome through
// the same three callbacks. Lifted wholesale from BuyButton so fan checkout
// and artist-side payments (distribution unlock) share one code path -- if
// a gateway quirk gets fixed here, it gets fixed for both.
//
// Semantics worth keeping: Squad's onClose fires AFTER onSuccess (so only
// report cancel while still waiting), and a Monipay popup that's already
// open IS the active payment -- the call is a silent no-op and the previous
// launch's callbacks stay in charge of its result.
export async function launchPayment(
  params: PaymentLaunchParams,
  cb: PaymentCallbacks,
): Promise<void> {
  let completed = false;

  if (params.gateway === "monipay") {
    try {
      await loadScript("https://js.monipay.ng/v2/inline.js");
    } catch {
      cb.onError(LOAD_FAILED);
      return;
    }
    if (!window.Monipay) {
      cb.onError(STILL_LOADING);
      return;
    }
    // Never stack popups: an open payment stays front and center instead of
    // opening the duplicate Monipay would reject.
    if (isMonipayPopupOpen()) return;
    new window.Monipay().checkout({
      key: params.publicKey,
      email: params.email,
      amount: params.amountKobo,
      metadata: { reference: params.reference },
      onCancel: () => cb.onCancel(),
      onError: (err) => {
        // Peel the errored popup off: if a live payment sits underneath, the
        // user lands back on it instead of a dead error screen.
        const rescued = dismissNewestMonipayPopup();
        cb.onError(
          rescued ? "You're back at your open payment — finish it there." : monipayPopupErrorMessage(err),
        );
      },
      onSuccess: (data) => {
        completed = true;
        cb.onSuccess(params.reference, data);
      },
    });
    return;
  }

  if (params.gateway === "squad") {
    // Squad's widget registers the transaction itself under `transaction_ref`
    // -- exactly like Monipay, no server-side pre-initiation.
    try {
      await openSquadCheckout({
        publicKey: params.publicKey,
        email: params.email,
        amountKobo: params.amountKobo,
        reference: params.reference,
        customerName: params.customerName,
        onSuccess: () => {
          completed = true;
          cb.onSuccess(params.reference);
        },
        onClose: () => {
          if (!completed) cb.onCancel();
        },
      });
    } catch {
      cb.onError(LOAD_FAILED);
    }
    return;
  }

  try {
    await loadScript("https://js.paystack.co/v1/inline.js");
  } catch {
    cb.onError(LOAD_FAILED);
    return;
  }
  if (!window.PaystackPop) {
    cb.onError(STILL_LOADING);
    return;
  }
  window.PaystackPop.setup({
    key: params.publicKey,
    email: params.email,
    amount: params.amountKobo,
    // Pin NGN: without this Paystack bills international cards in USD
    // (cents), which breaks the kobo-amount check in /api/checkout/verify.
    // Foreign banks convert at their own rate; the customer still pays.
    currency: "NGN",
    ref: params.reference,
    onClose: () => {
      if (!completed) cb.onCancel();
    },
    callback: (transaction) => {
      completed = true;
      cb.onSuccess(transaction.reference);
    },
  }).openIframe();
}

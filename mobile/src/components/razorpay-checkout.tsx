import { useEffect } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Everything the server needs to prove the payment really happened. */
export interface RazorpayResult {
  paymentId: string;
  orderId: string;
  signature: string;
}

export interface RazorpayCheckoutProps {
  visible: boolean;
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { email?: string; contact?: string };
  onSuccess: (result: RazorpayResult) => void;
  onFailure: (reason: string) => void;
  onDismiss: () => void;
}

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener('load', () => resolve()));
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the Razorpay checkout script.'));
    document.body.appendChild(script);
  });
}

// Web has no native module to bridge to, so this opens Razorpay's own
// checkout.js overlay directly on the page — the same integration a plain
// website would use. Renders nothing itself.
export function RazorpayCheckout({
  visible,
  keyId,
  orderId,
  amount,
  currency,
  name,
  description,
  prefill,
  onSuccess,
  onFailure,
  onDismiss,
}: RazorpayCheckoutProps) {
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    loadCheckoutScript()
      .then(() => {
        if (cancelled || !window.Razorpay) return;

        const instance = new window.Razorpay({
          key: keyId,
          order_id: orderId,
          amount,
          currency,
          name,
          description,
          prefill,
          handler: (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            onSuccess({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
          },
          modal: { ondismiss: onDismiss },
        });
        instance.open();
      })
      .catch((err: Error) => onFailure(err.message));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-opening on every prop identity change would reopen the modal mid-flow
  }, [visible, orderId]);

  return null;
}

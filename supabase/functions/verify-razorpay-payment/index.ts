// Settles a Razorpay payment: verifies the checkout signature, then marks the
// payment paid and the booking confirmed.
//
// The client used to do both writes itself with its own session. That meant
// anyone holding the anon key could PATCH a booking to 'confirmed' and never
// pay — the checkout overlay was decoration. The database now refuses those
// writes from a customer (20260824120100), so confirmation has to happen
// here, behind a signature only Razorpay could have produced.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

/** Razorpay signs `order_id|payment_id` with the key secret, HMAC-SHA256 hex. */
async function expectedSignature(orderId: string, paymentId: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`),
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant time: a length-or-first-difference early return leaks the prefix. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface Body {
  booking_id?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

export default {
  // "user" mode so ctx.supabase is scoped to the caller's RLS — the booking
  // lookup below can only see a booking that is actually theirs. The writes
  // then go through ctx.supabaseAdmin, which the integrity triggers exempt.
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (!RAZORPAY_KEY_SECRET) {
      return Response.json(
        { message: "Razorpay is not configured on the server." },
        { status: 500 },
      );
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const {
      booking_id: bookingId,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = body;

    if (!bookingId || !orderId || !paymentId || !signature) {
      return Response.json(
        {
          message:
            "booking_id, razorpay_order_id, razorpay_payment_id and razorpay_signature are all required.",
        },
        { status: 400 },
      );
    }

    const { data: booking, error: bookingError } = await ctx.supabase
      .from("bookings")
      .select("id, status")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      return Response.json({ message: bookingError.message }, { status: 400 });
    }
    if (!booking) {
      return Response.json({ message: "Booking not found." }, { status: 404 });
    }

    const expected = await expectedSignature(orderId, paymentId, RAZORPAY_KEY_SECRET);
    if (!safeEqual(expected, signature)) {
      return Response.json({ message: "Payment signature is not valid." }, { status: 400 });
    }

    // The order must be the one we created for *this* booking, or a valid
    // signature from some other (possibly ₹1) order would confirm it.
    const { data: payment, error: paymentLookupError } = await ctx.supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("booking_id", bookingId)
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (paymentLookupError) {
      return Response.json({ message: paymentLookupError.message }, { status: 400 });
    }
    if (!payment) {
      return Response.json(
        { message: "No payment order matches this booking." },
        { status: 409 },
      );
    }

    // Razorpay can fire the handler more than once; settling twice must not
    // re-confirm a booking an admin has since cancelled.
    if (payment.status === "paid") {
      return Response.json({ booking_id: bookingId, status: booking.status, already: true });
    }

    const { error: payError } = await ctx.supabaseAdmin
      .from("payments")
      .update({ status: "paid" })
      .eq("id", payment.id);

    if (payError) {
      return Response.json({ message: payError.message }, { status: 400 });
    }

    // Only advance a booking that is still waiting. If it was cancelled while
    // checkout was open, the payment stands as paid and needs a refund —
    // silently flipping it back to confirmed would hide that.
    if (booking.status !== "pending_payment") {
      return Response.json({
        booking_id: bookingId,
        status: booking.status,
        message: "Payment recorded, but the booking is no longer pending.",
      });
    }

    const { error: confirmError } = await ctx.supabaseAdmin
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", bookingId);

    if (confirmError) {
      return Response.json({ message: confirmError.message }, { status: 400 });
    }

    return Response.json({ booking_id: bookingId, status: "confirmed" });
  }),
};

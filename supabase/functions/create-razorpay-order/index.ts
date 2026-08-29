// Creates a Razorpay order for a booking and records it as a `payments` row
// (Phase 6, Prompt 17). The prompt says "store razorpay_order_id on the
// booking", but the actual schema already has payments.razorpay_order_id —
// storing it there instead of adding a duplicate column to bookings.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

export default {
  // "user" mode requires the caller's own session JWT, so ctx.supabase is
  // scoped to their RLS — the booking lookup below can only ever see a
  // booking that belongs to them (or an admin).
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return Response.json(
        { message: "Razorpay is not configured on the server." },
        { status: 500 },
      );
    }

    let bookingId: string | undefined;
    try {
      ({ booking_id: bookingId } = await req.json());
    } catch {
      return Response.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    if (!bookingId) {
      return Response.json({ message: "booking_id is required." }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await ctx.supabase
      .from("bookings")
      .select("id, net_price, status")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError) {
      return Response.json({ message: bookingError.message }, { status: 400 });
    }
    if (!booking) {
      return Response.json({ message: "Booking not found." }, { status: 404 });
    }
    if (booking.status !== "pending_payment") {
      return Response.json(
        { message: `Booking is already '${booking.status}', not pending payment.` },
        { status: 409 },
      );
    }

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      },
      body: JSON.stringify({
        amount: Math.round(Number(booking.net_price) * 100),
        currency: "INR",
        receipt: booking.id,
      }),
    });

    if (!razorpayResponse.ok) {
      const detail = await razorpayResponse.text();
      return Response.json(
        { message: "Razorpay order creation failed.", detail },
        { status: 502 },
      );
    }

    const order = (await razorpayResponse.json()) as RazorpayOrder;

    const { error: paymentError } = await ctx.supabase.from("payments").insert({
      booking_id: booking.id,
      amount: booking.net_price,
      status: "created",
      razorpay_order_id: order.id,
    });

    if (paymentError) {
      return Response.json({ message: paymentError.message }, { status: 400 });
    }

    return Response.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: RAZORPAY_KEY_ID,
    });
  }),
};

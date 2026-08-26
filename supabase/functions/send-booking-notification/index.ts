// Sends push notifications to the customer and (if assigned) the technician
// when a booking's status changes. Invoked by the private.notify_booking_
// status_change() Postgres trigger via pg_net (see migration
// 20260823180100_booking_status_webhook.sql), authenticated with the
// service_role key so it can read device_tokens across users.
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface NotificationCopy {
  title: string;
  body: string;
}

function customerCopy(status: string, serviceName: string): NotificationCopy | null {
  switch (status) {
    case "confirmed":
      return { title: "Booking confirmed", body: `Your ${serviceName} booking is confirmed.` };
    case "assigned":
      return { title: "Technician assigned", body: `A technician has been assigned to your ${serviceName} booking.` };
    case "in_progress":
      return { title: "Service started", body: `Your ${serviceName} service is now in progress.` };
    case "completed":
      return { title: "Service completed", body: `Your ${serviceName} service is complete.` };
    case "cancelled":
      return { title: "Booking cancelled", body: `Your ${serviceName} booking was cancelled.` };
    default:
      return null;
  }
}

function technicianCopy(status: string, serviceName: string): NotificationCopy | null {
  if (status !== "assigned") return null;
  return { title: "New assignment", body: `You've been assigned a ${serviceName} booking.` };
}

export default {
  // "secret" mode requires the service_role key — only the DB trigger
  // (via the Vault-stored key) or other trusted server code should call this.
  fetch: withSupabase({ auth: "secret" }, async (req, ctx) => {
    let body: { booking_id?: string; new_status?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    const { booking_id: bookingId, new_status: newStatus } = body;
    if (!bookingId || !newStatus) {
      return Response.json({ message: "booking_id and new_status are required." }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await ctx.supabaseAdmin
      .from("bookings")
      .select("user_id, technician_id, services(name)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return Response.json({ message: bookingError?.message ?? "Booking not found." }, { status: 404 });
    }

    const serviceName = (booking.services as { name: string } | null)?.name ?? "your service";
    const recipients: { profileId: string; copy: NotificationCopy }[] = [];

    const customerMessage = customerCopy(newStatus, serviceName);
    if (customerMessage) recipients.push({ profileId: booking.user_id, copy: customerMessage });

    if (booking.technician_id) {
      const technicianMessage = technicianCopy(newStatus, serviceName);
      if (technicianMessage) {
        const { data: technician } = await ctx.supabaseAdmin
          .from("technicians")
          .select("profile_id")
          .eq("id", booking.technician_id)
          .single();

        if (technician?.profile_id) {
          recipients.push({ profileId: technician.profile_id, copy: technicianMessage });
        }
      }
    }

    if (recipients.length === 0) {
      return Response.json({ sent: 0, message: "No notification for this status change." });
    }

    const profileIds = recipients.map((r) => r.profileId);
    const { data: tokens, error: tokensError } = await ctx.supabaseAdmin
      .from("device_tokens")
      .select("profile_id, token")
      .in("profile_id", profileIds);

    if (tokensError) {
      return Response.json({ message: tokensError.message }, { status: 400 });
    }

    const messages = (tokens ?? []).flatMap((row) => {
      const recipient = recipients.find((r) => r.profileId === row.profile_id);
      if (!recipient) return [];
      return [
        {
          to: row.token,
          title: recipient.copy.title,
          body: recipient.copy.body,
          data: { bookingId },
        },
      ];
    });

    if (messages.length === 0) {
      return Response.json({ sent: 0, message: "Recipients have no registered device tokens." });
    }

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();
    return Response.json({ sent: messages.length, expo: pushResult });
  }),
};

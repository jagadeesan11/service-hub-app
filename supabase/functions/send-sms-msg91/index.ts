// Supabase "Send SMS" auth hook, delivering OTPs through MSG91 instead of
// the built-in Twilio/Vonage/MessageBird providers.
//
// Two things about this are easy to get wrong:
//
//  1. Supabase generates the OTP itself and hands it to us in the payload, so
//     this uses MSG91's *Flow* API (send a templated message) — NOT MSG91's
//     OTP API, which would mint its own code that Supabase could never
//     verify.
//
//  2. Auth hooks are not called with an apikey/JWT — they're signed with the
//     Standard Webhooks scheme. The function therefore runs with
//     verify_jwt = false and authenticates the request itself. Skipping that
//     check would leave a public endpoint that sends SMS on your account:
//     an open relay that costs real money.
import "@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "standardwebhooks";

const HOOK_SECRET = Deno.env.get("SEND_SMS_HOOK_SECRET");
const MSG91_AUTHKEY = Deno.env.get("MSG91_AUTHKEY");
const MSG91_TEMPLATE_ID = Deno.env.get("MSG91_TEMPLATE_ID");

// Name of the variable inside your approved MSG91 template that holds the
// code, e.g. a template of "Your Nexora code is ##otp##" uses "otp".
const MSG91_OTP_VAR = Deno.env.get("MSG91_OTP_VAR") ?? "otp";

// See the escape-hatch block below. Never set this in production.
const DEV_LOG_OTP = Deno.env.get("SMS_DEV_LOG_OTP");

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow";

interface SendSmsPayload {
  user: { phone: string };
  sms: { otp: string };
}

function errorResponse(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: { http_code: status, message } }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * Supabase hands us E.164 ("+919876543210"); MSG91 wants the country code
 * without the plus ("919876543210").
 */
function toMsg91Mobile(phone: string) {
  return phone.replace(/[^0-9]/g, "");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  if (!HOOK_SECRET) {
    console.error("send-sms-msg91: SEND_SMS_HOOK_SECRET is not set.");
    return errorResponse("SMS delivery is not configured on the server.", 500);
  }

  // Signature is computed over the raw body, so read it as text — parsing
  // to JSON first and re-serialising would change the bytes and fail.
  const rawBody = await req.text();

  let payload: SendSmsPayload;
  try {
    const secret = HOOK_SECRET.replace("v1,whsec_", "");
    const webhook = new Webhook(secret);
    payload = webhook.verify(rawBody, Object.fromEntries(req.headers)) as SendSmsPayload;
  } catch (err) {
    console.error("send-sms-msg91: signature verification failed.", err);
    return errorResponse("Invalid webhook signature.", 401);
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp) {
    return errorResponse("Payload is missing user.phone or sms.otp.", 400);
  }

  // DEV ESCAPE HATCH — off unless SMS_DEV_LOG_OTP is explicitly "true".
  //
  // India's DLT approval gates real SMS for days or weeks, which otherwise
  // blocks all device testing. When enabled, the code is written to this
  // function's logs instead of being sent, so you can read it from the
  // dashboard and sign in with no provider at all.
  //
  // MUST be unset before launch. It puts login codes in plaintext logs, so
  // anyone who can read your function logs can complete a sign-in for any
  // number. Requests are still signature-verified, so this is not a public
  // bypass — but it does turn log access into account access.
  if (DEV_LOG_OTP === "true") {
    console.warn(
      `[SMS_DEV_LOG_OTP ACTIVE — do not use in production] OTP for ${phone} is ${otp}`,
    );
    return new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Checked only after the caller is authenticated, so an unsigned request
  // can't probe whether the provider is configured.
  if (!MSG91_AUTHKEY || !MSG91_TEMPLATE_ID) {
    const missing = [
      !MSG91_AUTHKEY && "MSG91_AUTHKEY",
      !MSG91_TEMPLATE_ID && "MSG91_TEMPLATE_ID",
    ].filter(Boolean).join(", ");
    console.error(`send-sms-msg91: missing ${missing}.`);
    // Names the missing variable so a half-finished setup is diagnosable
    // from the response instead of looking identical to a bad hook secret.
    return errorResponse(`SMS provider not configured: missing ${missing}.`, 500);
  }

  let msg91Response: Response;
  try {
    msg91Response = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: MSG91_AUTHKEY,
      },
      body: JSON.stringify({
        template_id: MSG91_TEMPLATE_ID,
        // Must be the STRING "1", not the number 1. MSG91 silently ignores
        // the numeric form and answers {"type":"success"} even for a bad
        // authkey or template — so without this exact value every failed
        // send looks delivered and the user waits for a code that is never
        // coming. Verified against the live API; do not "tidy" this to 1.
        realTimeResponse: "1",
        recipients: [
          {
            mobiles: toMsg91Mobile(phone),
            [MSG91_OTP_VAR]: otp,
          },
        ],
      }),
    });
  } catch (err) {
    console.error("send-sms-msg91: could not reach MSG91.", err);
    return errorResponse("Could not reach the SMS provider.", 502);
  }

  const body = await msg91Response.text();

  // MSG91 answers 200 with {"type":"error"} for template/DLT problems, so the
  // status code alone isn't enough — a bad template would otherwise look like
  // a delivered message and the user would wait for a code that never lands.
  let type: string | undefined;
  try {
    type = JSON.parse(body)?.type;
  } catch {
    // Non-JSON body: fall through to the status check below.
  }

  if (!msg91Response.ok || type === "error") {
    console.error("send-sms-msg91: MSG91 rejected the send.", msg91Response.status, body);
    return errorResponse("The SMS provider rejected the message.", 502);
  }

  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

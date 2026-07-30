/**
 * Emails a patient to confirm their intake questionnaire arrived.
 *
 * Two things this deliberately does NOT do:
 *   1. It never puts any of their answers in the message. Email is unencrypted,
 *      and a mistyped address would otherwise send a stranger a complete
 *      gynecological history.
 *   2. It never takes the message body from the request. Only the recipient and
 *      the greeting name come from outside, so this endpoint cannot be used to
 *      send arbitrary text that looks like it came from the clinic.
 *
 * Deploy on Cloudflare Workers. Setup steps are in README.md next to this file.
 */

const ALLOWED_ORIGIN = "https://kladiesclinic.github.io";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405);
    }
    // Without this check the Worker is an open relay for mail that appears to
    // come from the clinic. Origin is set by the browser and cannot be forged
    // by a page on another site.
    if ((request.headers.get("Origin") || "") !== ALLOWED_ORIGIN) {
      return json({ error: "forbidden" }, 403);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }

    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim().slice(0, 100);

    // Strict on purpose: exactly one plain address, so no comma-separated list
    // or display-name trickery can widen the recipient set.
    if (!/^[^\s@,<>"]+@[^\s@,<>"]+\.[^\s@,<>"]+$/.test(email)) {
      return json({ error: "invalid email" }, 400);
    }

    const greeting = name ? `Dear ${name},` : "Hello,";

    const text = [
      greeting,
      "",
      "Thank you, we have received your pre-consultation questionnaire.",
      "",
      "The doctor will read through your answers before your appointment, so your",
      "consultation time can go to your questions rather than paperwork.",
      "",
      "If you need to change or cancel your appointment, please use the reschedule",
      "link in your booking confirmation email. For anything else, just reply to",
      "this message and our English speaking staff will get back to you.",
      "",
      "K Ladies Clinic Shinjuku",
      "Gynecology Clinic, Shinjuku, Tokyo",
    ].join("\n");

    const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#2B2124">
<p>${escapeHtml(greeting)}</p>
<p>Thank you, we have received your pre-consultation questionnaire.</p>
<p>The doctor will read through your answers before your appointment, so your
consultation time can go to your questions rather than paperwork.</p>
<p>If you need to change or cancel your appointment, please use the reschedule link
in your booking confirmation email. For anything else, just reply to this message
and our English speaking staff will get back to you.</p>
<p style="margin-top:28px">K Ladies Clinic Shinjuku<br />
<span style="color:#7A6A66">Gynecology Clinic, Shinjuku, Tokyo</span></p>
</div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_ADDRESS,
        to: [email],
        reply_to: env.REPLY_TO || "staff@klcs.jp",
        subject: "We've received your questionnaire, K Ladies Clinic Shinjuku",
        html,
        text,
      }),
    });

    if (!res.ok) {
      // Shows up in the Worker's log tail. The page ignores this response, so a
      // failure here is invisible to the patient, whose form did go through.
      console.log("resend failed", res.status, await res.text());
      return json({ error: "send failed" }, 502);
    }
    return json({ ok: true }, 200);
  },
};

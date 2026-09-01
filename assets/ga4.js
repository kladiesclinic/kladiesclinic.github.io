/**
 * Google Analytics 4 (GA4), shared by the patient-facing pages.
 *
 * Reuses the same measurement ID as the main Japanese site (klcs.jp),
 * since klcs.jp/en is the same domain/property — traffic here shows up
 * in the same GA4 property, filterable by landing page path "/en/".
 *
 * gtag.js auto-detects utm_source/utm_medium/utm_campaign/utm_term/
 * utm_content from the URL query string; no extra code needed for that.
 *
 * Deliberately not loaded on the same pages pixel.js skips:
 *   intake.html   carries the patient's name, email, phone and medical
 *                 answers in form fields / page state.
 *   manual.html   staff only.
 *   staff.html    staff only.
 */
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag("js", new Date());
gtag("config", "G-334KEX8DJB");

/**
 * Meta Pixel base code, shared by the patient-facing pages.
 *
 * Deliberately not loaded on:
 *   intake.html   the questionnaire carries the patient's name, email, phone and
 *                 medical answers. Meta's Automatic Advanced Matching scrapes form
 *                 fields, and it can only be switched off in Events Manager, not
 *                 from here, so the page is left off the pixel entirely.
 *   manual.html   staff only.
 *   staff.html    staff only.
 *
 * booked.html arrives from Calendly with the patient's name in the query string.
 * That page strips it out of the address bar before this file runs, so the name is
 * never part of the URL the pixel reports.
 */
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '27415714044798059');
fbq('init', '2521081711690562');
fbq('track', 'PageView');

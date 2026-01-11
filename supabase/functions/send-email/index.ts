// Supabase Edge Function: Send Email
// Handles confirmation, reminder, waitlist, and cancellation emails via Resend API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'noreply@resend.dev'; // Using Resend's default domain for free tier

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Slot {
  date: string;
  day_of_week: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  checkin_open_at?: string; // ISO string
  checkin_token?: string;
}

interface EventDetails {
  title: string;
  organization_name: string;
  contact_person: string;
  contact_whatsapp: string;
}

interface EmailRequest {
  type: 'confirmation' | 'reminder' | 'waitlist_join' | 'waitlist_promote' | 'cancellation';
  name: string;
  email: string;
  slots: Slot[];
  event_details?: EventDetails;
  cancel_token?: string;
  checkin_token?: string;
  position?: number; // For waitlist join
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function formatAvailabilityTime(checkinOpenAt?: string): string {
  if (!checkinOpenAt) return '';
  const date = new Date(checkinOpenAt);
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `(available from ${h12}:${m} ${ampm})`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function sanitizeWhatsApp(number: string): string {
  return number.replace(/\D/g, '');
}

const COMMON_STYLES = `
  body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #FFFAF5; }
  .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .header { text-align: center; margin-bottom: 30px; }
  .card { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 6px rgba(45, 33, 24, 0.07); color: #2D2118; }
  .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5DCD3; color: #8B7B6F; font-size: 12px; }
  h1 { color: #8B4513; font-size: 24px; margin: 0; }
  h2 { font-size: 20px; margin: 0 0 10px; }
  h3 { color: #8B4513; font-size: 16px; margin: 0 0 15px; }
  p { font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: #6B5B4F; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 5px; }
  .btn-primary { background: #8B4513; color: white !important; }
  .btn-outline { border: 2px solid #8B4513; color: #8B4513 !important; }
  .btn-label { display: block; font-size: 10px; margin-top: 4px; opacity: 0.8; font-weight: 400; }
  .note-box { border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 25px; }
  th { padding: 12px; text-align: left; font-weight: 600; background: #F4E4C1; color: #2D2118; }
  td { padding: 12px; border-bottom: 1px solid #E5DCD3; }
`;

function generateConfirmationEmail(name: string, slots: Slot[], event: EventDetails, cancelToken?: string, checkinToken?: string): string {
  const orgName = event.organization_name || 'Volunteer Organization';
  const eventTitle = event.title || 'Volunteer Event';
  const cancelLink = cancelToken ? `https://siva-sub.github.io/volunteer-registration/cancel.html?token=${cancelToken}` : '';
  const checkinLink = checkinToken ? `https://siva-sub.github.io/volunteer-registration/checkin.html?token=${checkinToken}` : '';

  const shiftsHtml = slots.map(slot => `
    <tr>
      <td><strong>${slot.day_of_week}, ${formatDate(slot.date)}</strong></td>
      <td>${slot.shift_name} Shift</td>
      <td>${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES}</style></head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #FFFAF5;">
      <div class="wrapper">
        <div class="header">
          <div style="font-size: 48px; margin-bottom: 10px;">🙏</div>
          <h1>${orgName}</h1>
          <p style="margin: 5px 0 0;">${eventTitle}</p>
        </div>
        <div class="card">
          <h2 style="color: #4A7C59;">Registration Confirmed!</h2>
          <p>Dear ${name},</p>
          <p>Thank you for volunteering. Your service is greatly appreciated.</p>
          <h3>Your Volunteer Shifts:</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          ${slots.map(slot => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
              <div style="font-weight: 600;">${slot.day_of_week}, ${formatDate(slot.date)}</div>
              <div style="font-size: 14px; color: #666;">${slot.shift_name} (${formatTime(slot.start_time)} - ${formatTime(slot.end_time)})</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
              ${slot.checkin_token ? `
                <a href="https://siva-sub.github.io/volunteer-registration/checkin.html?token=${slot.checkin_token}" 
                   style="display: inline-block; padding: 6px 12px; background: #E3F2FD; color: #1565C0; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600;">
                  Check-in
                  ${slot.checkin_open_at ? `<div style="font-size: 10px; font-weight: normal; opacity: 0.8;">${formatAvailabilityTime(slot.checkin_open_at)}</div>` : ''}
                </a>
              ` : '<span style="color: #999; font-size: 13px;">Confirmed</span>'}
            </td>
          </tr>
          `).join('')}
        </table>

        <div class="note-box" style="background: #F5F5F5; color: #616161;">
          <p style="margin: 0; font-size: 14px;"><strong>💡 Pro Tip:</strong> You can use the "Check-in" links above directly from your phone when you arrive at the temple. We'll also send you a reminder email one day before each shift.</p>
        </div>

          ${cancelLink ? `
          <div class="note-box" style="background: #FFF3E0; color: #E65100;">
            <p style="color: inherit; margin-bottom: 10px;"><strong>Need to cancel?</strong> If you can no longer make it, please let us know.</p>
            <a href="${cancelLink}" class="btn btn-outline" style="border-color: #E65100; color: #E65100 !important;">Manage My Registration</a>
          </div>
          ` : ''}
          
          <p style="margin-top: 20px;">If you have any questions, please contact ${event.contact_person}.</p>
        </div>
        <div class="footer">${orgName}<br>${eventTitle}</div>
      </div>
    </body>
    </html>
  `;
}

function generateReminderEmail(name: string, slots: Slot[], event: EventDetails): string {
  const orgName = event.organization_name || 'Volunteer Organization';
  const eventTitle = event.title || 'Volunteer Event';

  return `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES}</style></head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
          <h1>${orgName}</h1>
          <p style="margin: 5px 0 0;">Shift Reminder</p>
        </div>
        <div class="card">
          <h2 style="color: #E6A817;">Your Shift is Tomorrow!</h2>
          <p>Dear ${name}, this is a friendly reminder that you are scheduled to volunteer tomorrow.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          ${slots.map(slot => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
              <div style="font-weight: 600;">${slot.shift_name}</div>
              <div style="font-size: 14px; color: #666;">${formatDate(slot.date)} (${formatTime(slot.start_time)} - ${formatTime(slot.end_time)})</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
              ${slot.checkin_token ? `
                <a href="https://siva-sub.github.io/volunteer-registration/checkin.html?token=${slot.checkin_token}" 
                   style="display: inline-block; padding: 10px 16px; background: #1565C0; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
                  Check-in
                  ${slot.checkin_open_at ? `<div style="font-size: 10px; font-weight: normal; opacity: 0.9;">${formatAvailabilityTime(slot.checkin_open_at)}</div>` : ''}
                </a>
              ` : ''}
            </td>
          </tr>
          `).join('')}
        </table>

          <div class="note-box" style="background: #E3F2FD; color: #1565C0;">
            <p style="margin: 0; font-size: 14px;"><strong>📋 Reminder:</strong> Please check-in using the direct links above once you arrive at the temple location.</p>
          </div>

          <p style="margin-top: 20px;">Please arrive 10-15 minutes before your shift starts. Thank you!</p>
        </div>
        <div class="footer">${orgName}</div>
      </div>
    </body>
    </html>
  `;
}

function generateWaitlistJoinEmail(name: string, slots: Slot[], event: EventDetails, position: number): string {
  const orgName = event.organization_name || 'Volunteer Organization';
  const eventTitle = event.title || 'Volunteer Event';

  return `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES}</style></head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div style="font-size: 48px; margin-bottom: 10px;">⏳</div>
          <h1>${orgName}</h1>
          <p style="margin: 5px 0 0;">Waitlist Confirmation</p>
        </div>
        <div class="card">
          <h2>You're on the list!</h2>
          <p>Dear ${name}, thank you for your interest. The shift you selected is currently full, but you've been added to the waitlist.</p>
          <div style="background: #F4E4C1; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
             <span style="font-size: 14px; display: block; margin-bottom: 5px;">Your Position</span>
             <strong style="font-size: 32px; color: #8B4513;">#${position}</strong>
          </div>
          <p><strong>Shift Details:</strong><br>${slots[0].shift_name} on ${formatDate(slots[0].date)}</p>
          <p>We will notify you immediately if a spot opens up for you.</p>
        </div>
        <div class="footer">${orgName}</div>
      </div>
    </body>
    </html>
  `;
}

function generateWaitlistPromoteEmail(name: string, slots: Slot[], event: EventDetails): string {
  const orgName = event.organization_name || 'Volunteer Organization';
  const eventTitle = event.title || 'Volunteer Event';

  return `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES}</style></head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div style="font-size: 48px; margin-bottom: 10px;">✨</div>
          <h1>${orgName}</h1>
          <p style="margin: 5px 0 0;">Spot Available!</p>
        </div>
        <div class="card">
          <h2 style="color: #4A7C59;">You've been promoted!</h2>
          <p>Dear ${name}, great news! A spot has opened up and you have been moved from the waitlist to a confirmed registration.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          ${slots.map(slot => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">
              <div style="font-weight: 600;">${slot.day_of_week}, ${formatDate(slot.date)}</div>
              <div style="font-size: 14px; color: #666;">${slot.shift_name} (${formatTime(slot.start_time)} - ${formatTime(slot.end_time)})</div>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">
              ${slot.checkin_token ? `
                <a href="https://siva-sub.github.io/volunteer-registration/checkin.html?token=${slot.checkin_token}" 
                   style="display: inline-block; padding: 6px 12px; background: #E3F2FD; color: #1565C0; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600;">
                  Check-in
                </a>
              ` : '<span style="color: #4A7C59; font-size: 13px; font-weight: 600;">Confirmed</span>'}
            </td>
          </tr>
          `).join('')}
        </table>

          <p>We look forward to seeing you there!</p>
        </div>
        <div class="footer">${orgName}</div>
      </div>
    </body>
    </html>
  `;
}

function generateCancellationEmail(name: string, slots: Slot[], event: EventDetails): string {
  const orgName = event.organization_name || 'Volunteer Organization';

  const shiftsHtml = slots.map(slot => `
    <li>${slot.shift_name} Shift on ${formatDate(slot.date)}</li>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><style>${COMMON_STYLES}</style></head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div style="font-size: 48px; margin-bottom: 10px;">👋</div>
          <h1>${orgName}</h1>
          <p style="margin: 5px 0 0;">Cancellation Confirmed</p>
        </div>
        <div class="card">
          <h2>Registration Cancelled</h2>
          <p>Dear ${name}, this email confirms that you have cancelled the following volunteer shift(s):</p>
          <ul style="color: #6B5B4F; font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
            ${shiftsHtml}
          </ul>
          <p>Thank you for letting us know. We hope to see you at a future event.</p>
        </div>
        <div class="footer">${orgName}</div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { type, name, email, slots, event_details, cancel_token, checkin_token, position }: EmailRequest = await req.json();

    if (!email || !name || !slots || slots.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Missing fields' }), { status: 400, headers: corsHeaders });
    }

    const event = event_details || { title: 'Volunteer Event', organization_name: 'Volunteer Organization', contact_person: 'Organizer', contact_whatsapp: '' };

    let subject = '';
    let html = '';

    switch (type) {
      case 'confirmation':
        subject = `Registration Confirmed — ${event.title}`;
        html = generateConfirmationEmail(name, slots, event, cancel_token, checkin_token);
        break;
      case 'reminder':
        subject = `Reminder: Shift Tomorrow for ${event.title}`;
        html = generateReminderEmail(name, slots, event);
        break;
      case 'waitlist_join':
        subject = `You're on the Waitlist — ${event.title}`;
        html = generateWaitlistJoinEmail(name, slots, event, position || 0);
        break;
      case 'waitlist_promote':
        subject = `✨ Spot Available: You've been promoted! — ${event.title}`;
        html = generateWaitlistPromoteEmail(name, slots, event);
        break;
      case 'cancellation':
        subject = `Cancellation Confirmed — ${event.title}`;
        html = generateCancellationEmail(name, slots, event);
        break;
      default:
        return new Response(JSON.stringify({ success: false, error: 'Invalid type' }), { status: 400, headers: corsHeaders });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to: [email], subject, html })
    });

    const result = await res.json();
    return new Response(JSON.stringify({ success: res.ok, id: result.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
});

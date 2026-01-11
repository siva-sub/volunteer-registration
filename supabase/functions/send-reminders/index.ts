// Supabase Edge Function: Send Reminders
// Sends reminder emails to volunteers with shifts tomorrow

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'noreply@resend.dev';

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
  checkin_open_at?: string;
  checkin_token?: string;
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

function generateReminderEmail(name: string, slots: Slot[], eventTitle: string, orgName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #FFFAF5; }
        .wrapper { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .header { text-align: center; margin-bottom: 30px; padding: 20px; border-bottom: 2px solid #F5E6D3; }
        .card { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 6px rgba(45, 33, 24, 0.07); color: #2D2118; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5DCD3; color: #8B7B6F; font-size: 12px; }
        h1 { color: #8B4513; font-size: 24px; margin: 0; }
        h2 { color: #E6A817; font-size: 20px; margin: 0 0 10px; }
        h3 { color: #8B4513; font-size: 16px; margin: 0 0 15px; }
        p { font-size: 14px; line-height: 1.6; margin: 0 0 20px; color: #6B5B4F; }
        .note-box { border-radius: 8px; padding: 15px; margin-top: 20px; font-size: 14px; background: #E3F2FD; color: #1565C0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
          <h1>${orgName}</h1>
          <p style="margin: 5px 0 0;">${eventTitle}</p>
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

          <p style="margin-top: 20px;">Please arrive 10-15 minutes before your shift starts. Thank you for your service!</p>
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
    const body = await req.json().catch(() => ({}));
    if (body.password !== 'temple2026') {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: reminders, error: fetchError } = await supabase.rpc('get_reminders_for_tomorrow');

    if (fetchError) throw fetchError;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: 'No reminders to send' }), { headers: corsHeaders });
    }

    // Group by email to send one email per person
    const byEmail = new Map<string, any>();
    for (const r of reminders) {
      if (!byEmail.has(r.email)) {
        byEmail.set(r.email, {
          name: r.full_name,
          slots: [],
          regSlotIds: [],
          eventTitle: r.event_title,
          orgName: r.organization_name
        });
      }
      const entry = byEmail.get(r.email);
      entry.slots.push({
        date: r.date,
        day_of_week: r.day_of_week,
        shift_name: r.shift_name,
        start_time: r.start_time,
        end_time: r.end_time,
        checkin_open_at: r.checkin_open_at,
        checkin_token: r.checkin_token
      });
      entry.regSlotIds.push(r.registration_slot_id);
    }

    let sentCount = 0;
    const allSentIds: string[] = [];

    for (const [email, data] of byEmail) {
      try {
        const html = generateReminderEmail(data.name, data.slots, data.eventTitle, data.orgName);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY} ` },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email],
            subject: `Reminder: Volunteer Shift Tomorrow — ${data.eventTitle} `,
            html: html
          })
        });

        if (res.ok) {
          sentCount++;
          allSentIds.push(...data.regSlotIds);
        }
      } catch (err) {
        console.error(`Error sending to ${email} `, err);
      }
    }

    // Mark as sent
    if (allSentIds.length > 0) {
      await supabase.from('registration_slots').update({ reminder_sent: true }).in('id', allSentIds);
    }

    return new Response(JSON.stringify({ success: true, count: sentCount }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
});

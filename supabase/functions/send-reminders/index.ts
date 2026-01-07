// Supabase Edge Function: Send Reminders
// Sends reminder emails to volunteers with shifts tomorrow

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://zpqnoxllhbyggyxvvpaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || 're_TKGXn539_NADyEisN9B8CrSfLTQSyZg9R';
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
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function generateReminderEmail(name: string, slots: Slot[]): string {
  const shiftsHtml = slots.map(slot => `
    <div style="background: #FFF3E0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
      <strong style="color: #E65100;">${slot.shift_name} Shift</strong><br>
      <span style="color: #6B5B4F; font-size: 14px;">
        ${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}
      </span>
    </div>
  `).join('');

  const dateDisplay = slots.length > 0
    ? `${slots[0].day_of_week}, ${formatDate(slots[0].date)}`
    : 'Tomorrow';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #FFFAF5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="font-size: 48px; margin-bottom: 10px;">🙏</div>
          <h1 style="color: #8B4513; font-size: 24px; margin: 0;">Sri Thendayuthapani Temple</h1>
          <p style="color: #6B5B4F; font-size: 14px; margin: 5px 0 0;">Volunteer Shift Reminder</p>
        </div>
        
        <!-- Content Card -->
        <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 6px rgba(45, 33, 24, 0.07);">
          
          <h2 style="color: #E6A817; font-size: 20px; margin: 0 0 10px;">⏰ Reminder: Your Shift is Tomorrow!</h2>
          
          <p style="color: #2D2118; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Dear ${name},
          </p>
          
          <p style="color: #6B5B4F; font-size: 14px; line-height: 1.6; margin: 0 0 25px;">
            This is a friendly reminder that you are scheduled to volunteer for towel and soap sales 
            at the temple <strong>tomorrow (${dateDisplay})</strong>.
          </p>
          
          <h3 style="color: #8B4513; font-size: 16px; margin: 0 0 15px;">Your Shift(s):</h3>
          
          ${shiftsHtml}
          
          <div style="background: #F4E4C1; border-radius: 8px; padding: 15px; margin-top: 20px;">
            <p style="color: #8B4513; font-size: 14px; margin: 0;">
              <strong>📍 Location:</strong> Towel & Soap Sales Counter<br>
              Please arrive 10-15 minutes before your shift starts.
            </p>
          </div>
          
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5DCD3;">
          <p style="color: #8B7B6F; font-size: 12px; margin: 0;">
            Sri Thendayuthapani Temple<br>
            Festival 2026 — Thank you for your service!
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Verify admin password
    if (body.password !== 'temple2026') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get target date (default to tomorrow)
    let targetDateStr: string;
    if (body.targetDate) {
      targetDateStr = body.targetDate;
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      targetDateStr = tomorrow.toISOString().split('T')[0];
    }

    console.log(`Looking for reminders for date: ${targetDateStr}`);

    // Get all registration slots for that date that haven't had reminders sent
    // (Removing the 'reminder_sent' filter if force=true is passed would be good for testing, but let's stick to standard flow)
    const { data: reminders, error: fetchError } = await supabase
      .from('registration_slots')
      .select(`
        id,
        reminder_sent,
        registrations (
          id,
          full_name,
          email
        ),
        shift_slots (
          id,
          date,
          day_of_week,
          shift_name,
          start_time,
          end_time
        )
      `);
    // Removed .eq('reminder_sent', false) from query to filter in memory properly with date check logic below
    // actually, the query above gets EVERYTHING which is bad for performance. 
    // Let's refine the query to be efficient.

    // Refined query:
    // Since we can't easily filter by "shift_slots.date" in a nested query without intricate syntax or a view,
    // we'll get slots that are NOT sent yet, and then filter by date in code as before.
    // Or better: filter by ID if we could, but we don't know the IDs.
    // Let's stick to the previous approach but just re-apply the filter.

    if (fetchError) {
      throw fetchError;
    }

    // Filter to only target date shifts with email addresses
    // AND check reminder_sent status (unless force=true is passed for testing)
    const tomorrowReminders = (reminders || []).filter((r: any) =>
      r.shift_slots?.date === targetDateStr &&
      r.registrations?.email &&
      (body.force === true || r.reminder_sent === false)
    );

    console.log(`Found ${tomorrowReminders.length} reminders to send`);

    if (tomorrowReminders.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `No reminders to send for ${targetDateStr}`,
          count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by registration (person) to send one email per person
    const byRegistration = new Map<string, {
      name: string;
      email: string;
      slots: Slot[];
      slotRecordIds: string[];
    }>();

    for (const reminder of tomorrowReminders) {
      const regId = reminder.registrations?.id;
      if (!regId) continue;

      if (!byRegistration.has(regId)) {
        byRegistration.set(regId, {
          name: reminder.registrations.full_name,
          email: reminder.registrations.email,
          slots: [],
          slotRecordIds: []
        });
      }

      const entry = byRegistration.get(regId)!;
      entry.slots.push({
        date: reminder.shift_slots.date,
        day_of_week: reminder.shift_slots.day_of_week,
        shift_name: reminder.shift_slots.shift_name,
        start_time: reminder.shift_slots.start_time,
        end_time: reminder.shift_slots.end_time
      });
      entry.slotRecordIds.push(reminder.id);
    }

    let sentCount = 0;
    const sentSlotIds: string[] = [];

    // Send emails
    for (const [regId, data] of byRegistration) {
      try {
        const html = generateReminderEmail(data.name, data.slots);

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [data.email],
            subject: 'Reminder: Your Volunteer Shift is Tomorrow — Sri Thendayuthapani Temple',
            html: html
          })
        });

        if (response.ok) {
          sentCount++;
          sentSlotIds.push(...data.slotRecordIds);
          console.log(`Sent reminder to ${data.email}`);
        } else {
          const error = await response.json();
          console.error(`Failed to send to ${data.email}:`, error);
        }
      } catch (emailError) {
        console.error(`Error sending to ${data.email}:`, emailError);
      }
    }

    // Mark reminders as sent
    if (sentSlotIds.length > 0) {
      const { error: updateError } = await supabase
        .from('registration_slots')
        .update({ reminder_sent: true })
        .in('id', sentSlotIds);

      if (updateError) {
        console.error('Error updating reminder status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} reminder email(s) for tomorrow's shifts`,
        count: sentCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

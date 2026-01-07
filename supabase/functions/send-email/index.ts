// Supabase Edge Function: Send Email
// Handles confirmation and reminder emails via Resend API

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
}

interface EmailRequest {
  type: 'confirmation' | 'reminder';
  name: string;
  email: string;
  slots: Slot[];
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

function generateConfirmationEmail(name: string, slots: Slot[]): string {
  const shiftsHtml = slots.map(slot => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #E5DCD3;">
        <strong>${slot.day_of_week}, ${formatDate(slot.date)}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5DCD3;">
        ${slot.shift_name} Shift
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5DCD3;">
        ${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}
      </td>
    </tr>
  `).join('');

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
          <p style="color: #6B5B4F; font-size: 14px; margin: 5px 0 0;">Festival Volunteer Registration</p>
        </div>
        
        <!-- Content Card -->
        <div style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 4px 6px rgba(45, 33, 24, 0.07);">
          
          <h2 style="color: #4A7C59; font-size: 20px; margin: 0 0 10px;">Registration Confirmed!</h2>
          
          <p style="color: #2D2118; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
            Dear ${name},
          </p>
          
          <p style="color: #6B5B4F; font-size: 14px; line-height: 1.6; margin: 0 0 25px;">
            Thank you for volunteering to help with towel and soap sales at the temple. 
            Your service during the festival period is greatly appreciated.
          </p>
          
          <h3 style="color: #8B4513; font-size: 16px; margin: 0 0 15px;">Your Volunteer Shifts:</h3>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 25px;">
            <thead>
              <tr style="background: #F4E4C1;">
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #2D2118;">Date</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #2D2118;">Shift</th>
                <th style="padding: 12px; text-align: left; font-weight: 600; color: #2D2118;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${shiftsHtml}
            </tbody>
          </table>
          
          <div style="background: #E8F5E9; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="color: #4A7C59; font-size: 14px; margin: 0;">
              <strong>📧 Reminder:</strong> You will receive a reminder email one day before each of your shifts.
            </p>
          </div>
          
          <p style="color: #6B5B4F; font-size: 14px; line-height: 1.6; margin: 0;">
            If you need to make any changes to your registration, please contact the temple directly.
          </p>
          
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5DCD3;">
          <p style="color: #8B7B6F; font-size: 12px; margin: 0;">
            Sri Thendayuthapani Temple<br>
            Festival 2026 — Towel & Soap Sales Volunteer Coordination
          </p>
        </div>
        
      </div>
    </body>
    </html>
  `;
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
    const { type, name, email, slots }: EmailRequest = await req.json();

    if (!email || !name || !slots || slots.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate email content
    const subject = type === 'confirmation'
      ? 'Volunteer Registration Confirmed — Sri Thendayuthapani Temple'
      : 'Reminder: Your Volunteer Shift is Tomorrow — Sri Thendayuthapani Temple';

    const html = type === 'confirmation'
      ? generateConfirmationEmail(name, slots)
      : generateReminderEmail(name, slots);

    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: subject,
        html: html
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
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

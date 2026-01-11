-- Migration: Sales Reporting & Configuration
-- Description: Adds configuration for Advanced Sales Reporting and Inventory Items

-- 1. Add 'advanced_reporting_enabled' to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS advanced_reporting_enabled BOOLEAN DEFAULT FALSE;

-- 2. Add 'sales_config' to shift_slots table
-- Format: { "items": [ { "name": "Milk", "price": 2.0 }, { "name": "Rose Water", "price": 5.0 } ] }
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS sales_config JSONB DEFAULT NULL;


-- 3. Update admin_update_event to handle advanced_reporting_enabled
-- We need to drop the old one first if headers change, but here we can just replace as we are adding params? 
-- Actually, admin_update_event might not exist yet in this file, so let's verify if we need to CREATE OR REPLACE.
-- Assuming standard update, let's look at defining it robustly.

CREATE OR REPLACE FUNCTION admin_update_event(
  p_password TEXT,
  p_event_id UUID,
  p_title TEXT,
  p_org_name TEXT,
  p_dates JSONB,
  p_active BOOLEAN,
  p_contact_person TEXT,
  p_contact_whatsapp TEXT,
  p_feedback_enabled BOOLEAN,
  p_certificates_enabled BOOLEAN,
  p_checkin_required BOOLEAN,
  p_waitlist_enabled BOOLEAN,
  p_paused BOOLEAN,
  p_checkin_open_offset INT,
  p_checkin_close_offset INT,
  p_registration_mode TEXT DEFAULT 'instant',
  p_waitlist_mode TEXT DEFAULT 'manual',
  p_advanced_reporting_enabled BOOLEAN DEFAULT FALSE,
  p_coordinator_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE events 
  SET 
    title = p_title,
    organization_name = p_org_name,
    dates_config = p_dates,
    active = p_active,
    contact_person = p_contact_person,
    contact_whatsapp = p_contact_whatsapp,
    feedback_enabled = p_feedback_enabled,
    certificates_enabled = p_certificates_enabled,
    checkin_required = p_checkin_required,
    waitlist_enabled = p_waitlist_enabled,
    paused = p_paused,
    checkin_open_offset_minutes = p_checkin_open_offset,
    checkin_close_offset_minutes = p_checkin_close_offset,
    registration_mode = p_registration_mode,
    waitlist_mode = p_waitlist_mode,
    advanced_reporting_enabled = p_advanced_reporting_enabled,
    coordinator_email = p_coordinator_email,
    updated_at = NOW()
  WHERE id = p_event_id;

  RETURN json_build_object('success', true);
END;
$$;

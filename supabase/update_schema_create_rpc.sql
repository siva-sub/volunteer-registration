-- =====================================================
-- MIGRATION: ADMIN CREATE EVENT RPC
-- Reason: Direct insert fails RLS. Using RPC for password-protected creation.
-- =====================================================

CREATE OR REPLACE FUNCTION admin_create_event(
  p_password TEXT,
  p_title TEXT,
  p_organization_name TEXT,
  p_contact_person TEXT,
  p_contact_whatsapp TEXT,
  p_active BOOLEAN,
  p_dates_config JSONB,
  p_feedback_enabled BOOLEAN,
  p_certificates_enabled BOOLEAN,
  p_checkin_required BOOLEAN,
  p_paused BOOLEAN,
  p_waitlist_enabled BOOLEAN,
  p_coordinator_email TEXT,
  p_checkin_open_offset_minutes INT,
  p_checkin_close_offset_minutes INT,
  p_registration_mode TEXT DEFAULT 'instant',
  p_waitlist_mode TEXT DEFAULT 'manual',
  p_advanced_reporting_enabled BOOLEAN DEFAULT FALSE,
  p_default_float_amount NUMERIC DEFAULT 0,
  p_is_hidden BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_event_id UUID;
BEGIN
  -- Security Check
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO events (
    title,
    organization_name,
    description,
    contact_person,
    contact_whatsapp,
    dates_config,
    active,
    feedback_enabled,
    certificates_enabled,
    checkin_required,
    paused,
    waitlist_enabled,
    coordinator_email,
    checkin_open_offset_minutes,
    checkin_close_offset_minutes,
    registration_mode,
    waitlist_mode,
    advanced_reporting_enabled,
    default_float_amount,
    is_hidden
  ) VALUES (
    p_title,
    p_organization_name,
    'Volunteer Registration', -- hardcoded default matches JS
    p_contact_person,
    p_contact_whatsapp,
    p_dates_config,
    p_active,
    p_feedback_enabled,
    p_certificates_enabled,
    p_checkin_required,
    p_paused,
    p_waitlist_enabled,
    p_coordinator_email,
    p_checkin_open_offset_minutes,
    p_checkin_close_offset_minutes,
    p_registration_mode::registration_mode_enum,
    p_waitlist_mode::waitlist_mode_enum,
    p_advanced_reporting_enabled,
    p_default_float_amount,
    p_is_hidden
  )
  RETURNING id INTO v_new_event_id;

  RETURN json_build_object(
    'success', true, 
    'event_id', v_new_event_id,
    'data', (SELECT row_to_json(e) FROM events e WHERE id = v_new_event_id)
  );
END;
$$;

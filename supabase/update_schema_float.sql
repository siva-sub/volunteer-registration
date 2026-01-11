-- =====================================================
-- MIGRATION: DEFAULT FLOAT AMOUNT
-- =====================================================

-- 1. Add 'default_float_amount' to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS default_float_amount NUMERIC DEFAULT 0;

-- 2. Update admin_update_event to handle default_float_amount
CREATE OR REPLACE FUNCTION admin_update_event(
  p_password TEXT,
  p_event_id UUID,
  p_title TEXT,
  p_organization_name TEXT,
  p_contact_person TEXT,
  p_contact_whatsapp TEXT,
  p_active BOOLEAN,
  p_feedback_enabled BOOLEAN,
  p_certificates_enabled BOOLEAN,
  p_paused BOOLEAN,
  p_waitlist_enabled BOOLEAN,
  p_checkin_required BOOLEAN,
  p_coordinator_email TEXT,
  p_checkin_open_offset_minutes INT,
  p_checkin_close_offset_minutes INT,
  p_registration_mode TEXT DEFAULT 'instant',
  p_waitlist_mode TEXT DEFAULT 'manual',
  p_advanced_reporting_enabled BOOLEAN DEFAULT FALSE,
  p_default_float_amount NUMERIC DEFAULT 0
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
    organization_name = p_organization_name,
    active = p_active,
    contact_person = p_contact_person,
    contact_whatsapp = p_contact_whatsapp,
    feedback_enabled = p_feedback_enabled,
    certificates_enabled = p_certificates_enabled,
    checkin_required = p_checkin_required,
    waitlist_enabled = p_waitlist_enabled,
    paused = p_paused,
    checkin_open_offset_minutes = p_checkin_open_offset_minutes,
    checkin_close_offset_minutes = p_checkin_close_offset_minutes,
    registration_mode = p_registration_mode,
    waitlist_mode = p_waitlist_mode,
    advanced_reporting_enabled = p_advanced_reporting_enabled,
    coordinator_email = p_coordinator_email,
    default_float_amount = p_default_float_amount,
    updated_at = NOW()
  WHERE id = p_event_id;

  RETURN json_build_object('success', true);
END;
$$;


-- 3. Update get_report_form to use default_float_amount fallback
CREATE OR REPLACE FUNCTION get_report_form(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_shift RECORD;
  v_leader_exists BOOLEAN;
  v_default_float NUMERIC;
BEGIN
  -- 1. Identify Volunteer
  SELECT rs.*, r.full_name
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token OR rs.cancel_token = p_token;

  IF v_reg_slot IS NULL THEN
     RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- 2. Get Shift Details
  SELECT s.*, (s.date + s.end_time)::TIMESTAMPTZ as shift_end_ts
  INTO v_shift
  FROM shift_slots s
  WHERE s.id = v_reg_slot.slot_id;

  -- 3. Get Default Float from Event
  SELECT default_float_amount INTO v_default_float
  FROM events
  WHERE id = v_shift.event_id;

  -- 4. Check Leader Status
  SELECT EXISTS (
    SELECT 1 FROM registration_slots 
    WHERE slot_id = v_reg_slot.slot_id AND is_shift_leader = true
  ) INTO v_leader_exists;

  -- 5. Permission Logic
  IF v_shift.report_required AND v_leader_exists AND NOT v_reg_slot.is_shift_leader THEN
     RETURN json_build_object(
       'success', false, 
       'error', 'Shift Leader will submit the report.',
       'is_non_leader_block', true
     );
  END IF;

  RETURN json_build_object(
    'success', true,
    'volunteer_name', v_reg_slot.full_name,
    'shift_name', v_shift.shift_name,
    'shift_date', v_shift.date,
    'shift_end_at', v_shift.shift_end_ts,
    'report_required', v_shift.report_required,
    'float_amount', COALESCE(v_shift.float_amount, v_default_float, 0), -- Fallback
    'sales_config', v_shift.sales_config,
    'already_submitted', v_reg_slot.report_submitted,
    'is_shift_leader', v_reg_slot.is_shift_leader
  );
END;
$$;

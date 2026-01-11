-- =====================================================
-- ADVANCED REPORTING & LEADER LOGIC
-- =====================================================

-- 1. Update check_in to return leader status and availability
CREATE OR REPLACE FUNCTION check_in(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_shift RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_opens_at TIMESTAMPTZ;
  v_closes_at TIMESTAMPTZ;
  v_leader_exists BOOLEAN;
BEGIN
  -- Get Registration & Slot Info
  SELECT rs.*, r.full_name, s.event_id, s.date, s.start_time, s.end_time, s.shift_name,
         s.checkin_open_at, s.checkin_close_at, s.report_required
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  JOIN shift_slots s ON s.id = rs.slot_id
  WHERE rs.checkin_token = p_token;

  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('status', 'error', 'error', 'Invalid token');
  END IF;

  -- Time Windows
  v_opens_at := v_reg_slot.checkin_open_at;
  v_closes_at := v_reg_slot.checkin_close_at;

  -- Status Checks
  IF v_now < v_opens_at THEN
    RETURN json_build_object(
      'status', 'too_early', 
      'volunteer_name', v_reg_slot.full_name,
      'opens_at', v_opens_at
    );
  END IF;

  IF v_now > v_closes_at THEN
    -- Even if late, check if already checked in
    IF v_reg_slot.checked_in THEN 
       -- Pass through to 'already_checked_in' logic
    ELSE
       RETURN json_build_object(
         'status', 'too_late',
         'volunteer_name', v_reg_slot.full_name,
         'closed_at', v_closes_at
       );
    END IF;
  END IF;

  -- Process Check-in
  IF v_reg_slot.checked_in THEN
    RETURN json_build_object(
      'status', 'already_checked_in',
      'volunteer_name', v_reg_slot.full_name,
      'checked_in_at', v_reg_slot.checked_in_at,
      'shift_date', v_reg_slot.date,
      'shift_name', v_reg_slot.shift_name,
      'is_shift_leader', v_reg_slot.is_shift_leader,
      'report_required', v_reg_slot.report_required
    );
  END IF;

  -- Perform Check-in
  UPDATE registration_slots
  SET checked_in = true, checked_in_at = v_now
  WHERE id = v_reg_slot.id;

  -- Check if ANY leader is assigned to this shift (for logic: if leader exists, only they report)
  SELECT EXISTS (
    SELECT 1 FROM registration_slots 
    WHERE slot_id = v_reg_slot.slot_id AND is_shift_leader = true
  ) INTO v_leader_exists;

  RETURN json_build_object(
    'status', 'success',
    'volunteer_name', v_reg_slot.full_name,
    'checked_in_at', v_now,
    'shift_date', v_reg_slot.date,
    'shift_name', v_reg_slot.shift_name,
    'is_shift_leader', v_reg_slot.is_shift_leader,
    'report_required', v_reg_slot.report_required,
    'leader_exists', v_leader_exists
  );
END;
$$;


-- 2. Update get_report_form to include Float & Leader Logic
CREATE OR REPLACE FUNCTION get_report_form(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_shift RECORD;
  v_leader_exists BOOLEAN;
  v_end_at TIMESTAMPTZ;
BEGIN
  -- 1. Identify Volunteer
  SELECT rs.*, r.full_name
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token OR rs.cancel_token = p_token; -- Allow either or just checkin

  IF v_reg_slot IS NULL THEN
     RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- 2. Get Shift Details
  SELECT s.*, (s.date + s.end_time)::TIMESTAMPTZ as shift_end_ts
  INTO v_shift
  FROM shift_slots s
  WHERE s.id = v_reg_slot.slot_id;

  -- 3. Check Leader Status
  SELECT EXISTS (
    SELECT 1 FROM registration_slots 
    WHERE slot_id = v_reg_slot.slot_id AND is_shift_leader = true
  ) INTO v_leader_exists;

  -- 4. Permission Logic
  -- If report NOT required -> OK (optional)
  -- If required:
  --    If leader exists AND I am NOT leader -> "Leader will submit"
  --    Else -> OK
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
    'float_amount', v_shift.float_amount,
    'sales_config', v_shift.sales_config,
    'already_submitted', v_reg_slot.report_submitted, -- assuming column exists or we add it
    'is_shift_leader', v_reg_slot.is_shift_leader
  );
END;
$$;

-- 3. Update submit_shift_report to handle discrepancy
-- First, ensure we have columns for advanced reporting
ALTER TABLE registration_slots 
ADD COLUMN IF NOT EXISTS start_float NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS end_cash NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_reason TEXT;

CREATE OR REPLACE FUNCTION submit_shift_report(
  p_token UUID,
  p_report_data JSONB, -- items sold
  p_notes TEXT,
  p_start_float NUMERIC DEFAULT 0,
  p_end_cash NUMERIC DEFAULT 0,
  p_discrepancy NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
BEGIN
  SELECT * INTO v_reg_slot FROM registration_slots WHERE checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  UPDATE registration_slots
  SET 
    report_submitted = true,
    report_data = p_report_data,
    notes = p_notes,
    start_float = p_start_float,
    end_cash = p_end_cash,
    discrepancy_amount = p_discrepancy,
    updated_at = NOW()
  WHERE id = v_reg_slot.id;

  RETURN json_build_object('success', true);
END;
$$;

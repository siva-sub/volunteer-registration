-- =====================================================
-- MIGRATION: PHASE 3 & 4 FEATURES
-- Self-Service Cancellation, Waitlist, Check-in, Feedback
-- =====================================================

-- =====================================================
-- 1. SELF-SERVICE CANCELLATION
-- =====================================================

-- Add cancel_token to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS cancel_token UUID DEFAULT gen_random_uuid();

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_registrations_cancel_token ON registrations(cancel_token);

-- Function to cancel slots
CREATE OR REPLACE FUNCTION cancel_slots(
  p_token UUID,
  p_slot_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registration RECORD;
  v_slot_id UUID;
  v_cancelled_count INT := 0;
  v_reg_slot RECORD;
BEGIN
  -- Find registration by token
  SELECT * INTO v_registration FROM registrations WHERE cancel_token = p_token;
  
  IF v_registration IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;
  
  -- Cancel each requested slot
  FOREACH v_slot_id IN ARRAY p_slot_ids
  LOOP
    -- Delete from registration_slots
    DELETE FROM registration_slots 
    WHERE registration_id = v_registration.id AND slot_id = v_slot_id
    RETURNING * INTO v_reg_slot;
    
    IF v_reg_slot IS NOT NULL THEN
      -- Decrement slot count
      UPDATE shift_slots 
      SET registered_count = registered_count - 1 
      WHERE id = v_slot_id AND registered_count > 0;
      
      v_cancelled_count := v_cancelled_count + 1;
      
      -- TODO: Trigger waitlist promotion here if needed
    END IF;
  END LOOP;
  
  -- If no more slots, soft delete registration
  IF NOT EXISTS (SELECT 1 FROM registration_slots WHERE registration_id = v_registration.id) THEN
    UPDATE registrations SET deleted_at = NOW() WHERE id = v_registration.id;
  END IF;
  
  RETURN json_build_object(
    'success', true, 
    'cancelled_count', v_cancelled_count,
    'registration_deleted', NOT EXISTS (SELECT 1 FROM registration_slots WHERE registration_id = v_registration.id)
  );
END;
$$;

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION cancel_slots(UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION cancel_slots(UUID, UUID[]) TO service_role;

-- Function to get registration by cancel token
CREATE OR REPLACE FUNCTION get_registration_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registration RECORD;
  v_slots JSON;
BEGIN
  SELECT r.*, e.title as event_title, e.organization_name
  INTO v_registration
  FROM registrations r
  JOIN registration_slots rs ON rs.registration_id = r.id
  JOIN shift_slots ss ON ss.id = rs.slot_id
  JOIN events e ON e.id = ss.event_id
  WHERE r.cancel_token = p_token AND r.deleted_at IS NULL
  GROUP BY r.id, e.title, e.organization_name
  LIMIT 1;
  
  IF v_registration IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;
  
  -- Get slots for this registration
  SELECT json_agg(json_build_object(
    'id', rs.id,
    'slot_id', ss.id,
    'date', ss.date,
    'shift_name', ss.shift_name,
    'start_time', ss.start_time,
    'end_time', ss.end_time,
    'station', ss.station,
    'can_cancel', ss.date >= CURRENT_DATE -- Can only cancel future slots
  ))
  INTO v_slots
  FROM registration_slots rs
  JOIN shift_slots ss ON ss.id = rs.slot_id
  WHERE rs.registration_id = v_registration.id;
  
  RETURN json_build_object(
    'success', true,
    'registration', json_build_object(
      'id', v_registration.id,
      'full_name', v_registration.full_name,
      'email', v_registration.email,
      'event_title', v_registration.event_title,
      'organization_name', v_registration.organization_name
    ),
    'slots', COALESCE(v_slots, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_registration_by_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_registration_by_token(UUID) TO service_role;


-- =====================================================
-- 2. WAITLIST SYSTEM
-- =====================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES shift_slots(id) NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  UNIQUE(slot_id, phone)
);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages waitlist" ON waitlist
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert to waitlist" ON waitlist
  FOR INSERT TO anon WITH CHECK (true);

-- Join Waitlist Function
CREATE OR REPLACE FUNCTION join_waitlist(
  p_slot_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_position INT;
  v_waitlist_id UUID;
BEGIN
  -- Validate slot exists
  SELECT * INTO v_slot FROM shift_slots WHERE id = p_slot_id AND deleted_at IS NULL;
  IF v_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Slot not found');
  END IF;
  
  -- Check if slot is actually full
  IF v_slot.registered_count < v_slot.capacity THEN
    RETURN json_build_object('success', false, 'error', 'Slot is not full, please register directly');
  END IF;
  
  -- Check if already on waitlist
  IF EXISTS (SELECT 1 FROM waitlist WHERE slot_id = p_slot_id AND phone = p_phone AND promoted_at IS NULL AND expired_at IS NULL) THEN
    RETURN json_build_object('success', false, 'error', 'Already on waitlist for this slot');
  END IF;
  
  -- Get next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position 
  FROM waitlist 
  WHERE slot_id = p_slot_id AND promoted_at IS NULL AND expired_at IS NULL;
  
  -- Insert
  INSERT INTO waitlist (slot_id, full_name, phone, email, position)
  VALUES (p_slot_id, p_name, p_phone, p_email, v_position)
  RETURNING id INTO v_waitlist_id;
  
  RETURN json_build_object(
    'success', true,
    'waitlist_id', v_waitlist_id,
    'position', v_position
  );
END;
$$;

GRANT EXECUTE ON FUNCTION join_waitlist(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION join_waitlist(UUID, TEXT, TEXT, TEXT) TO service_role;


-- =====================================================
-- 3. CHECK-IN SYSTEM
-- =====================================================

-- Add check-in config to shift_slots
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_required BOOLEAN DEFAULT TRUE;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_window_mode TEXT DEFAULT 'auto';
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_open_offset_minutes INTEGER DEFAULT 30;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_close_offset_minutes INTEGER DEFAULT 120;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_open_at TIMESTAMPTZ;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_close_at TIMESTAMPTZ;

-- Add check-in tracking to registration_slots
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS checkin_token UUID DEFAULT gen_random_uuid();
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_registration_slots_checkin_token ON registration_slots(checkin_token);

-- Check-in Function
CREATE OR REPLACE FUNCTION check_in(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_open_at TIMESTAMPTZ;
  v_close_at TIMESTAMPTZ;
  v_shift_start TIMESTAMPTZ;
BEGIN
  -- Find registration slot
  SELECT rs.*, r.full_name
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('status', 'invalid_token', 'error', 'Invalid check-in link');
  END IF;
  
  -- Already checked in?
  IF v_reg_slot.checked_in_at IS NOT NULL THEN
    RETURN json_build_object(
      'status', 'already_checked_in', 
      'checked_in_at', v_reg_slot.checked_in_at,
      'volunteer_name', v_reg_slot.full_name
    );
  END IF;
  
  -- Get slot config
  SELECT * INTO v_slot FROM shift_slots WHERE id = v_reg_slot.slot_id;
  
  IF NOT v_slot.checkin_required THEN
    RETURN json_build_object('status', 'not_required', 'message', 'Check-in is not required for this shift');
  END IF;
  
  -- Calculate window
  v_shift_start := (v_slot.date || ' ' || v_slot.start_time)::TIMESTAMPTZ;
  
  IF v_slot.checkin_window_mode = 'custom' AND v_slot.checkin_open_at IS NOT NULL THEN
    v_open_at := v_slot.checkin_open_at;
    v_close_at := v_slot.checkin_close_at;
  ELSE
    v_open_at := v_shift_start - (v_slot.checkin_open_offset_minutes * INTERVAL '1 minute');
    v_close_at := v_shift_start + (v_slot.checkin_close_offset_minutes * INTERVAL '1 minute');
  END IF;
  
  -- Check window
  IF NOW() < v_open_at THEN
    RETURN json_build_object(
      'status', 'too_early',
      'opens_at', v_open_at,
      'volunteer_name', v_reg_slot.full_name
    );
  END IF;
  
  IF NOW() > v_close_at THEN
    RETURN json_build_object(
      'status', 'too_late',
      'closed_at', v_close_at,
      'volunteer_name', v_reg_slot.full_name
    );
  END IF;
  
  -- Perform check-in
  UPDATE registration_slots SET checked_in_at = NOW() WHERE id = v_reg_slot.id;
  
  RETURN json_build_object(
    'status', 'success',
    'checked_in_at', NOW(),
    'volunteer_name', v_reg_slot.full_name,
    'shift_date', v_slot.date,
    'shift_name', v_slot.shift_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_in(UUID) TO anon;
GRANT EXECUTE ON FUNCTION check_in(UUID) TO service_role;


-- =====================================================
-- 4. FEEDBACK SYSTEM
-- =====================================================

-- Feedback Questions Table
CREATE TABLE IF NOT EXISTS feedback_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'stars', -- 'stars', 'rating', 'freeform'
  required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages feedback_questions" ON feedback_questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Public can view feedback questions" ON feedback_questions
  FOR SELECT TO anon USING (true);

-- Feedback Responses Table
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES feedback_questions(id) NOT NULL,
  registration_slot_id UUID REFERENCES registration_slots(id) NOT NULL,
  response_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, registration_slot_id)
);

ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages feedback_responses" ON feedback_responses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert feedback" ON feedback_responses
  FOR INSERT TO anon WITH CHECK (true);

-- Add feedback config to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS feedback_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS certificates_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;

-- Add feedback tracking to registration_slots
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS feedback_submitted_at TIMESTAMPTZ;

-- Add certificate tracking to registration_slots
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS certificate_url TEXT;
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS certificate_generated_at TIMESTAMPTZ;

-- Submit Feedback Function
CREATE OR REPLACE FUNCTION submit_feedback(
  p_token UUID,
  p_responses JSONB -- Array of {question_id, value}
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_response JSONB;
BEGIN
  -- Find registration slot by checkin token (reusing for feedback)
  SELECT rs.*, r.full_name
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  IF v_reg_slot.feedback_submitted_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Feedback already submitted');
  END IF;
  
  -- Insert responses
  FOR v_response IN SELECT * FROM jsonb_array_elements(p_responses)
  LOOP
    INSERT INTO feedback_responses (question_id, registration_slot_id, response_value)
    VALUES (
      (v_response->>'question_id')::UUID,
      v_reg_slot.id,
      v_response->>'value'
    )
    ON CONFLICT (question_id, registration_slot_id) DO UPDATE SET response_value = EXCLUDED.response_value;
  END LOOP;
  
  -- Mark as submitted
  UPDATE registration_slots SET feedback_submitted_at = NOW() WHERE id = v_reg_slot.id;
  
  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_feedback(UUID, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION submit_feedback(UUID, JSONB) TO service_role;

-- Get Feedback Questions for a Registration
CREATE OR REPLACE FUNCTION get_feedback_form(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_event RECORD;
  v_questions JSON;
BEGIN
  -- Find registration slot
  SELECT rs.*, r.full_name
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  -- Get slot and event
  SELECT * INTO v_slot FROM shift_slots WHERE id = v_reg_slot.slot_id;
  SELECT * INTO v_event FROM events WHERE id = v_slot.event_id;
  
  IF NOT v_event.feedback_enabled THEN
    RETURN json_build_object('success', false, 'error', 'Feedback not enabled for this event');
  END IF;
  
  IF v_reg_slot.feedback_submitted_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Feedback already submitted', 'already_submitted', true);
  END IF;
  
  -- Get questions
  SELECT json_agg(json_build_object(
    'id', id,
    'question_text', question_text,
    'question_type', question_type,
    'required', required
  ) ORDER BY sort_order)
  INTO v_questions
  FROM feedback_questions
  WHERE event_id = v_event.id;
  
  RETURN json_build_object(
    'success', true,
    'event_title', v_event.title,
    'volunteer_name', v_reg_slot.full_name,
    'shift_date', v_slot.date,
    'shift_name', v_slot.shift_name,
    'questions', COALESCE(v_questions, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_feedback_form(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_feedback_form(UUID) TO service_role;

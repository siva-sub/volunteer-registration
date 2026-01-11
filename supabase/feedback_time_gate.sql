-- =====================================================
-- FEEDBACK TIME GATING
-- =====================================================

-- 1. Update get_feedback_form to include shift end timestamp
CREATE OR REPLACE FUNCTION get_feedback_form(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_shift RECORD;
  v_event RECORD;
  v_questions JSON;
  v_response_exists BOOLEAN;
  v_end_timestamp TIMESTAMPTZ;
BEGIN
  -- 1. Verify Token
  SELECT rs.id, rs.registration_id, rs.slot_id, r.full_name, rs.feedback_submitted
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token; -- Using checkin_token as the feedback token for simplicity

  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- 2. Check if already submitted
  IF v_reg_slot.feedback_submitted THEN
    RETURN json_build_object('success', false, 'already_submitted', true);
  END IF;

  -- 3. Get Shift Details
  SELECT s.*, (s.date + s.end_time)::TIMESTAMPTZ as end_at
  INTO v_shift
  FROM shift_slots s
  WHERE s.id = v_reg_slot.slot_id;
  
  -- 4. Get Event Details
  SELECT * INTO v_event FROM events WHERE id = v_shift.event_id;

  -- 5. Get Questions
  SELECT json_agg(q ORDER BY q.sort_order) INTO v_questions
  FROM feedback_questions q
  WHERE q.event_id = v_shift.event_id;

  RETURN json_build_object(
    'success', true,
    'event_title', v_event.title,
    'shift_name', v_shift.shift_name,
    'shift_date', v_shift.date,
    'shift_end_at', v_shift.end_at,
    'volunteer_name', v_reg_slot.full_name,
    'questions', COALESCE(v_questions, '[]'::json)
  );
END;
$$;

-- 2. Update submit_feedback to enforce time gate
CREATE OR REPLACE FUNCTION submit_feedback(
  p_token UUID,
  p_responses JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_shift_end_at TIMESTAMPTZ;
  v_question RECORD;
  v_resp JSONB;
BEGIN
  -- 1. Verify Token & Get Slot Info
  SELECT rs.id, rs.registration_id, rs.slot_id, rs.feedback_submitted, (s.date + s.end_time)::TIMESTAMPTZ as end_at
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN shift_slots s ON s.id = rs.slot_id
  WHERE rs.checkin_token = p_token;

  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  IF v_reg_slot.feedback_submitted THEN
    RETURN json_build_object('success', false, 'error', 'Feedback already submitted');
  END IF;

  -- 2. Time Gate Check
  IF NOW() < v_reg_slot.end_at THEN
     RETURN json_build_object('success', false, 'error', 'Feedback not yet open');
  END IF;

  -- 3. Insert Responses
  FOR v_resp IN SELECT * FROM jsonb_array_elements(p_responses)
  LOOP
    INSERT INTO feedback_responses (registration_slot_id, question_id, response_value)
    VALUES (v_reg_slot.id, (v_resp->>'question_id')::UUID, v_resp->>'value');
  END LOOP;

  -- 4. Mark as Submitted
  UPDATE registration_slots
  SET feedback_submitted = true
  WHERE id = v_reg_slot.id;

  RETURN json_build_object('success', true);
END;
$$;

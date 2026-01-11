-- =====================================================
-- COORDINATION FIX MIGRATION
-- Bridges frontend RPC calls to backend logic
-- =====================================================

-- 1. CHECK-IN ALIGNMENT
-- =====================================================
-- Frontend expects 'check_in', migration had 'enforce_check_in'
CREATE OR REPLACE FUNCTION check_in(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN enforce_check_in(p_token);
END; $$;

-- 2. REPORTING SUPPORT
-- =====================================================
-- Fetches data for the reporting form
CREATE OR REPLACE FUNCTION get_report_form(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_event RECORD;
BEGIN
  SELECT rs.*, r.full_name INTO v_reg_slot
  FROM registration_slots rs JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  
  IF EXISTS (SELECT 1 FROM shift_reports WHERE registration_slot_id = v_reg_slot.id) THEN
    RETURN json_build_object('success', false, 'error', 'Report already submitted', 'already_submitted', true);
  END IF;
  
  SELECT * INTO v_slot FROM shift_slots WHERE id = v_reg_slot.slot_id;
  SELECT * INTO v_event FROM events WHERE id = v_slot.event_id;
  
  RETURN json_build_object(
    'success', true,
    'volunteer_name', v_reg_slot.full_name,
    'event_title', v_event.title,
    'shift_name', v_slot.shift_name,
    'shift_date', v_slot.date,
    'slot_type', COALESCE(v_slot.slot_type, 'standard'),
    'sales_config', v_slot.sales_config,
    'report_required', COALESCE(v_slot.report_required, false)
  );
END; $$;

-- 3. FEEDBACK SUPPORT
-- =====================================================
-- Fetches dynamic questions for the feedback form
CREATE OR REPLACE FUNCTION get_feedback_form(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_event RECORD;
  v_questions JSON;
BEGIN
  SELECT rs.*, r.full_name INTO v_reg_slot
  FROM registration_slots rs JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  
  IF v_reg_slot.feedback_submitted_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Feedback already submitted', 'already_submitted', true);
  END IF;
  
  SELECT * INTO v_slot FROM shift_slots WHERE id = v_reg_slot.slot_id;
  SELECT * INTO v_event FROM events WHERE id = v_slot.event_id;
  
  -- Auto-create default questions if none exist
  PERFORM create_default_feedback_questions(v_event.id);
  
  SELECT json_agg(q ORDER BY q.display_order) INTO v_questions
  FROM (SELECT id, question_text, question_type, display_order, is_required as required FROM feedback_questions WHERE event_id = v_event.id) q;
  
  RETURN json_build_object(
    'success', true,
    'volunteer_name', v_reg_slot.full_name,
    'event_title', v_event.title,
    'shift_name', v_slot.shift_name,
    'shift_date', v_slot.date,
    'questions', v_questions
  );
END; $$;

-- Submits feedback responses
CREATE OR REPLACE FUNCTION submit_feedback(p_token UUID, p_responses JSONB)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg_slot RECORD;
  v_response RECORD;
BEGIN
  SELECT * INTO v_reg_slot FROM registration_slots WHERE checkin_token = p_token;
  IF v_reg_slot IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  IF v_reg_slot.feedback_submitted_at IS NOT NULL THEN RETURN json_build_object('success', false, 'error', 'Already submitted'); END IF;
  
  FOR v_response IN SELECT * FROM jsonb_to_recordset(p_responses) AS x(question_id UUID, value TEXT)
  LOOP
    INSERT INTO feedback_responses (registration_slot_id, question_id, response)
    VALUES (v_reg_slot.id, v_response.question_id, v_response.value)
    ON CONFLICT (registration_slot_id, question_id) DO UPDATE SET response = EXCLUDED.response;
  END LOOP;
  
  UPDATE registration_slots SET feedback_submitted_at = NOW() WHERE id = v_reg_slot.id;
  RETURN json_build_object('success', true);
END; $$;

-- 4. CANCELLATION SUPPORT
-- =====================================================
CREATE OR REPLACE FUNCTION get_registration_by_token(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg RECORD;
  v_slots JSON;
BEGIN
  SELECT r.*, e.title as event_title 
  INTO v_reg
  FROM registrations r
  JOIN registration_slots rs ON rs.registration_id = r.id
  JOIN shift_slots ss ON ss.id = rs.slot_id
  JOIN events e ON e.id = ss.event_id
  WHERE r.cancel_token = p_token
  LIMIT 1;
  
  IF v_reg IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  
  SELECT json_agg(s ORDER BY s.date, s.start_time) INTO v_slots
  FROM (
    SELECT rs.id as slot_id, ss.date, ss.start_time, ss.end_time, ss.shift_name, ss.station,
           (ss.date > CURRENT_DATE) as can_cancel
    FROM registration_slots rs
    JOIN shift_slots ss ON ss.id = rs.slot_id
    WHERE rs.registration_id = v_reg.id
  ) s;
  
  RETURN json_build_object(
    'success', true,
    'registration', v_reg,
    'slots', v_slots
  );
END; $$;

CREATE OR REPLACE FUNCTION cancel_slots(p_token UUID, p_slot_ids UUID[])
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg_id UUID;
  v_count INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT id INTO v_reg_id FROM registrations WHERE cancel_token = p_token;
  IF v_reg_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  
  DELETE FROM registration_slots WHERE registration_id = v_reg_id AND id = ANY(p_slot_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  SELECT COUNT(*) INTO v_remaining FROM registration_slots WHERE registration_id = v_reg_id;
  
  IF v_remaining = 0 THEN
    DELETE FROM registrations WHERE id = v_reg_id;
    RETURN json_build_object('success', true, 'cancelled_count', v_count, 'registration_deleted', true);
  END IF;
  
  RETURN json_build_object('success', true, 'cancelled_count', v_count, 'registration_deleted', false);
END; $$;

-- 5. ADMIN ENHANCEMENTS
-- =====================================================
CREATE OR REPLACE FUNCTION admin_get_shift_reports(p_password TEXT, p_event_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_password != 'temple2026' THEN RETURN json_build_object('success', false, 'error', 'Unauthorized'); END IF;
  
  RETURN json_build_object(
    'success', true,
    'data', (
      SELECT json_agg(r ORDER BY r.submitted_at DESC)
      FROM (
        SELECT sr.*, r.full_name as volunteer_name, ss.shift_name, ss.date as shift_date
        FROM shift_reports sr
        JOIN registration_slots rs ON rs.id = sr.registration_slot_id
        JOIN registrations r ON r.id = rs.registration_id
        JOIN shift_slots ss ON ss.id = sr.slot_id
        WHERE sr.event_id = p_event_id
      ) r
    )
  );
END; $$;

-- Permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

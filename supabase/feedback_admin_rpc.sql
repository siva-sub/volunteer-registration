-- =====================================================
-- FEEDBACK SYSTEM ADMIN RPCs
-- =====================================================

-- 1. Create Default Feedback Questions
CREATE OR REPLACE FUNCTION create_default_feedback_questions(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Question 1: Overall Experience (Stars)
  INSERT INTO feedback_questions (event_id, question_text, question_type, required, sort_order)
  VALUES (p_event_id, 'How would you rate your overall experience volunteering with us?', 'stars', true, 10);

  -- Question 2: Organization (Rating 1-10)
  INSERT INTO feedback_questions (event_id, question_text, question_type, required, sort_order)
  VALUES (p_event_id, 'On a scale of 1-10, how well-organized was the event?', 'rating', false, 20);

  -- Question 3: Workload (Rating 1-10)
  INSERT INTO feedback_questions (event_id, question_text, question_type, required, sort_order)
  VALUES (p_event_id, 'How manageable was the workload during your shift? (1=Too Light, 10=Too Heavy)', 'rating', false, 30);

  -- Question 4: Comments (Freeform)
  INSERT INTO feedback_questions (event_id, question_text, question_type, required, sort_order)
  VALUES (p_event_id, 'Do you have any suggestions or comments for future events?', 'freeform', false, 40);

  RETURN json_build_object('success', true, 'message', 'Default questions created');
END;
$$;

-- 2. Get Feedback Summary for Admin
CREATE OR REPLACE FUNCTION get_feedback_summary(
  p_password TEXT,
  p_event_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats JSON;
  v_questions JSON;
  v_total INT;
BEGIN
  -- Security Check
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get Total Responses
  SELECT COUNT(DISTINCT registration_slot_id) INTO v_total
  FROM feedback_responses fr
  JOIN feedback_questions fq ON fq.id = fr.question_id
  WHERE fq.event_id = p_event_id;

  -- Get Per-Question Stats
  -- We aggregate responses for each question
  SELECT json_agg(q_data) INTO v_questions
  FROM (
      SELECT 
          fq.id,
          fq.question_text,
          fq.question_type,
          (
             SELECT json_agg(r.response_value)
             FROM feedback_responses r
             WHERE r.question_id = fq.id
          ) as responses,
          (
             SELECT AVG(response_value::NUMERIC)
             FROM feedback_responses r
             WHERE r.question_id = fq.id AND fq.question_type IN ('stars', 'rating') AND r.response_value ~ '^[0-9\.]+$'
          ) as average_rating
      FROM feedback_questions fq
      WHERE fq.event_id = p_event_id
      ORDER BY fq.sort_order
  ) q_data;

  RETURN json_build_object(
    'success', true,
    'total_responses', v_total,
    'questions', COALESCE(v_questions, '[]'::json)
  );
END;
$$;

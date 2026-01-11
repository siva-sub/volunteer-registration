-- =====================================================
-- SALES & INVENTORY TRACKING MIGRATION
-- =====================================================

-- Add coordinator email to events for reminders
ALTER TABLE events ADD COLUMN IF NOT EXISTS coordinator_email TEXT;

-- Waitlist feature toggle
ALTER TABLE events ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT FALSE;

-- Check-in configuration on events (defaults for all slots)
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_window_mode TEXT DEFAULT 'auto'; -- 'auto' or 'custom'
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_open_offset_minutes INTEGER DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_close_offset_minutes INTEGER DEFAULT 120;

-- Add slot type and sales configuration to shift_slots
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'standard';
-- slot_type: 'standard' (check-in only), 'sales' (requires report), 'inventory' (track quantities)

ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS sales_config JSONB;
-- Example: {"items": [{"name": "Towel", "unit_price": 5}, {"name": "Milk Packet", "unit_price": 2}]}

-- Per-slot reporting configuration
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS report_required BOOLEAN DEFAULT FALSE;
-- If TRUE, at least one volunteer must submit a report for reconciliation

-- Float (initial cash) for sales slots
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS float_amount DECIMAL(10,2);

-- Per-slot check-in override (optional custom window)
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_open_at TIMESTAMPTZ;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_close_at TIMESTAMPTZ;

-- Shift leader designation
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS is_shift_leader BOOLEAN DEFAULT FALSE;

-- Shift reports submitted by volunteers
CREATE TABLE IF NOT EXISTS shift_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_slot_id UUID REFERENCES registration_slots(id) NOT NULL,
  slot_id UUID REFERENCES shift_slots(id) NOT NULL,
  event_id UUID REFERENCES events(id) NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  report_data JSONB NOT NULL,
  -- Example report_data for sales:
  -- {
  --   "items_sold": [
  --     {"name": "Towel", "quantity": 50, "unit_price": 5, "amount": 250},
  --     {"name": "Soap", "quantity": 30, "unit_price": 3, "amount": 90}
  --   ],
  --   "total_amount": 340,
  --   "payment_method": "cash"
  -- }
  notes TEXT,
  status TEXT DEFAULT 'submitted', -- 'submitted', 'verified', 'flagged'
  verified_by TEXT, -- admin name
  verified_at TIMESTAMPTZ,
  UNIQUE(registration_slot_id) -- one report per volunteer per slot
);

-- Enable RLS
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages shift_reports" ON shift_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert shift_reports" ON shift_reports
  FOR INSERT TO anon WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_shift_reports_slot_id ON shift_reports(slot_id);
CREATE INDEX IF NOT EXISTS idx_shift_reports_event_id ON shift_reports(event_id);

-- =====================================================
-- RPC: Submit Shift Report
-- =====================================================
CREATE OR REPLACE FUNCTION submit_shift_report(
  p_token UUID, -- checkin token to identify the volunteer's registration_slot
  p_report_data JSONB,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_existing RECORD;
BEGIN
  -- Find registration slot by checkin token
  SELECT rs.*, r.full_name
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;
  
  -- Get slot details
  SELECT * INTO v_slot FROM shift_slots WHERE id = v_reg_slot.slot_id;
  
  -- Check if report already submitted
  SELECT * INTO v_existing FROM shift_reports WHERE registration_slot_id = v_reg_slot.id;
  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Report already submitted');
  END IF;
  
  -- Insert report
  INSERT INTO shift_reports (
    registration_slot_id,
    slot_id,
    event_id,
    report_data,
    notes
  )
  VALUES (
    v_reg_slot.id,
    v_slot.id,
    v_slot.event_id,
    p_report_data,
    p_notes
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Report submitted successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_shift_report(UUID, JSONB, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_shift_report(UUID, JSONB, TEXT) TO service_role;

-- =====================================================
-- RPC: Get Report Form (check if reporting needed)
-- =====================================================
CREATE OR REPLACE FUNCTION get_report_form(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_event RECORD;
  v_existing RECORD;
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
  
  -- Check if already submitted
  SELECT * INTO v_existing FROM shift_reports WHERE registration_slot_id = v_reg_slot.id;
  IF v_existing IS NOT NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Report already submitted',
      'already_submitted', true
    );
  END IF;
  
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
END;
$$;

GRANT EXECUTE ON FUNCTION get_report_form(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_report_form(UUID) TO service_role;

-- =====================================================
-- ENHANCED TEMPLATES WITH SALES ITEMS
-- =====================================================

-- Update existing templates or add new ones
INSERT INTO event_templates (name, category, description, icon, slot_config, default_settings) VALUES
-- Towel & Soap Sales
('Towel & Soap Sales', 'sales', 'Sales counter for towels and soap', '🧼',
'{"slots": [
  {"name": "Sales Counter - Morning", "start": "08:00", "end": "12:00", "capacity": 2, "station": "Sales Counter"},
  {"name": "Sales Counter - Afternoon", "start": "12:00", "end": "16:00", "capacity": 2, "station": "Sales Counter"},
  {"name": "Sales Counter - Evening", "start": "16:00", "end": "20:00", "capacity": 2, "station": "Sales Counter"}
],
"slot_type": "sales",
"report_required": true,
"sales_config": {
  "items": [
    {"name": "Towel", "unit_price": 5.00},
    {"name": "Soap", "unit_price": 3.00}
  ]
}}',
'{"checkin_required": true, "feedback_enabled": false, "certificates_enabled": false}'),

-- Paal Kudam Token Sales
('Paal Kudam Token Sales', 'sales', 'Token sales for Thaipusam Paal Kudam', '🥛',
'{"slots": [
  {"name": "Token Sales - Morning", "start": "09:00", "end": "13:00", "capacity": 3, "station": "Token Counter"},
  {"name": "Token Sales - Afternoon", "start": "13:00", "end": "17:00", "capacity": 3, "station": "Token Counter"}
],
"slot_type": "sales",
"report_required": true,
"sales_config": {
  "items": [
    {"name": "Paal Kudam Token", "unit_price": 10.00}
  ]
}}',
'{"checkin_required": true, "feedback_enabled": false, "certificates_enabled": false}'),

-- Milk Packet Sales
('Milk Packet Sales', 'sales', 'Milk packet sales for devotees', '🥛',
'{"slots": [
  {"name": "Milk Sales - Morning", "start": "06:00", "end": "10:00", "capacity": 4, "station": "Milk Counter"},
  {"name": "Milk Sales - Afternoon", "start": "10:00", "end": "14:00", "capacity": 4, "station": "Milk Counter"},
  {"name": "Milk Sales - Evening", "start": "14:00", "end": "18:00", "capacity": 3, "station": "Milk Counter"}
],
"slot_type": "sales",
"report_required": true,
"sales_config": {
  "items": [
    {"name": "Milk Packet (500ml)", "unit_price": 2.50},
    {"name": "Milk Packet (1L)", "unit_price": 4.00}
  ]
}}',
'{"checkin_required": true, "feedback_enabled": false, "certificates_enabled": false}')

ON CONFLICT DO NOTHING;

-- =====================================================
-- RPC: Enforce Check-in (with window validation)
-- =====================================================
CREATE OR REPLACE FUNCTION enforce_check_in(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_event RECORD;
  v_open_at TIMESTAMPTZ;
  v_close_at TIMESTAMPTZ;
BEGIN
  -- Find registration slot by checkin token
  SELECT rs.*, r.full_name
  INTO v_reg_slot
  FROM registration_slots rs
  JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token', 'status', 'invalid');
  END IF;
  
  -- Already checked in?
  IF v_reg_slot.checked_in_at IS NOT NULL THEN
    RETURN json_build_object('success', true, 'status', 'already_checked_in', 'checked_in_at', v_reg_slot.checked_in_at);
  END IF;
  
  -- Get slot and event
  SELECT * INTO v_slot FROM shift_slots WHERE id = v_reg_slot.slot_id;
  SELECT * INTO v_event FROM events WHERE id = v_slot.event_id;
  
  -- Check if check-in is required
  IF NOT COALESCE(v_event.checkin_required, true) THEN
    RETURN json_build_object('success', true, 'status', 'not_required');
  END IF;
  
  -- Compute check-in window
  IF v_slot.checkin_open_at IS NOT NULL AND v_slot.checkin_close_at IS NOT NULL THEN
    -- Custom window on slot
    v_open_at := v_slot.checkin_open_at;
    v_close_at := v_slot.checkin_close_at;
  ELSE
    -- Auto window from event settings
    v_open_at := (v_slot.date || ' ' || v_slot.start_time)::TIMESTAMPTZ 
                 - (COALESCE(v_event.checkin_open_offset_minutes, 30) * INTERVAL '1 minute');
    v_close_at := (v_slot.date || ' ' || v_slot.start_time)::TIMESTAMPTZ 
                  + (COALESCE(v_event.checkin_close_offset_minutes, 120) * INTERVAL '1 minute');
  END IF;
  
  -- Validate window
  IF NOW() < v_open_at THEN
    RETURN json_build_object('success', false, 'status', 'too_early', 
                             'opens_at', v_open_at, 'message', 'Check-in not yet open');
  END IF;
  
  IF NOW() > v_close_at THEN
    RETURN json_build_object('success', false, 'status', 'too_late', 
                             'closed_at', v_close_at, 'message', 'Check-in window has closed');
  END IF;
  
  -- Mark as checked in
  UPDATE registration_slots SET checked_in_at = NOW() WHERE id = v_reg_slot.id;
  
  RETURN json_build_object('success', true, 'status', 'checked_in', 
                           'volunteer_name', v_reg_slot.full_name);
END;
$$;

GRANT EXECUTE ON FUNCTION enforce_check_in(UUID) TO anon;
GRANT EXECUTE ON FUNCTION enforce_check_in(UUID) TO service_role;

-- =====================================================
-- RPC: Join Waitlist
-- =====================================================
CREATE OR REPLACE FUNCTION join_waitlist(
  p_slot_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot RECORD;
  v_event RECORD;
  v_position INTEGER;
BEGIN
  -- Get slot and event
  SELECT * INTO v_slot FROM shift_slots WHERE id = p_slot_id;
  IF v_slot IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Slot not found');
  END IF;
  
  SELECT * INTO v_event FROM events WHERE id = v_slot.event_id;
  
  -- Check if waitlist is enabled
  IF NOT COALESCE(v_event.waitlist_enabled, false) THEN
    RETURN json_build_object('success', false, 'error', 'Waitlist not enabled for this event');
  END IF;
  
  -- Check if slot is actually full
  IF v_slot.registered_count < v_slot.capacity THEN
    RETURN json_build_object('success', false, 'error', 'Slot still has availability');
  END IF;
  
  -- Get next position
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM waitlist WHERE slot_id = p_slot_id;
  
  -- Add to waitlist
  INSERT INTO waitlist (slot_id, event_id, full_name, phone, email, position)
  VALUES (p_slot_id, v_slot.event_id, p_full_name, p_phone, p_email, v_position);
  
  RETURN json_build_object('success', true, 'position', v_position, 
                           'message', 'Added to waitlist at position ' || v_position);
END;
$$;

GRANT EXECUTE ON FUNCTION join_waitlist(UUID, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION join_waitlist(UUID, TEXT, TEXT, TEXT) TO service_role;

-- =====================================================
-- FEEDBACK QUESTIONS SYSTEM
-- =====================================================

-- Feedback questions per event
CREATE TABLE IF NOT EXISTS feedback_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'stars' (1-5), 'rating' (1-10), 'freeform' (text)
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_questions_event ON feedback_questions(event_id);

-- Enable RLS
ALTER TABLE feedback_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages feedback_questions" ON feedback_questions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can read feedback_questions" ON feedback_questions
  FOR SELECT TO anon USING (true);

-- =====================================================
-- RPC: Create Default Feedback Questions
-- =====================================================
CREATE OR REPLACE FUNCTION create_default_feedback_questions(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only create if none exist
  IF EXISTS (SELECT 1 FROM feedback_questions WHERE event_id = p_event_id) THEN
    RETURN;
  END IF;

  INSERT INTO feedback_questions (event_id, question_text, question_type, display_order, is_required) VALUES
    (p_event_id, 'How would you rate your overall experience?', 'stars', 1, true),
    (p_event_id, 'How well organized was the event?', 'stars', 2, false),
    (p_event_id, 'Would you volunteer again?', 'rating', 3, false),
    (p_event_id, 'Any suggestions for improvement?', 'freeform', 4, false);
END;
$$;

GRANT EXECUTE ON FUNCTION create_default_feedback_questions(UUID) TO service_role;

-- =====================================================
-- RPC: Get Feedback Summary (for admin)
-- =====================================================
CREATE OR REPLACE FUNCTION get_feedback_summary(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_responses', (SELECT COUNT(DISTINCT registration_id) FROM feedback WHERE event_id = p_event_id),
    'questions', (
      SELECT json_agg(q ORDER BY q.display_order)
      FROM (
        SELECT 
          fq.id,
          fq.question_text,
          fq.question_type,
          fq.display_order,
          CASE 
            WHEN fq.question_type IN ('stars', 'rating') THEN
              (SELECT AVG((fr.response)::NUMERIC) FROM feedback_responses fr WHERE fr.question_id = fq.id)
            ELSE NULL
          END as average_score,
          CASE
            WHEN fq.question_type = 'freeform' THEN
              (SELECT json_agg(fr.response) FROM feedback_responses fr WHERE fr.question_id = fq.id AND fr.response IS NOT NULL AND fr.response != '')
            ELSE NULL
          END as text_responses,
          (SELECT COUNT(*) FROM feedback_responses fr WHERE fr.question_id = fq.id) as response_count
        FROM feedback_questions fq
        WHERE fq.event_id = p_event_id
      ) q
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_feedback_summary(UUID) TO service_role;

-- Feedback responses table (links responses to questions)
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES feedback_questions(id) ON DELETE CASCADE NOT NULL,
  response TEXT,
  UNIQUE(feedback_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_responses_question ON feedback_responses(question_id);

ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages feedback_responses" ON feedback_responses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert feedback_responses" ON feedback_responses
  FOR INSERT TO anon WITH CHECK (true);

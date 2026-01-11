-- =====================================================
-- COMPREHENSIVE VOLUNTEER REGISTRATION MIGRATION
-- Includes: Sales, Check-in, Waitlist, and Feedback
-- =====================================================

-- 1. BASE SCHEMA UPDATES
-- =====================================================

-- Add coordinator email to events for reminders
ALTER TABLE events ADD COLUMN IF NOT EXISTS coordinator_email TEXT;

-- Waitlist feature toggle
ALTER TABLE events ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN DEFAULT FALSE;

-- Check-in configuration on events
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_window_mode TEXT DEFAULT 'auto';
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_open_offset_minutes INTEGER DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_close_offset_minutes INTEGER DEFAULT 120;

-- Add slot type and sales configuration to shift_slots
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'standard';
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS sales_config JSONB;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS report_required BOOLEAN DEFAULT FALSE;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS float_amount DECIMAL(10,2);
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_open_at TIMESTAMPTZ;
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS checkin_close_at TIMESTAMPTZ;

-- Registration slot updates (Check-in & Leader)
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS is_shift_leader BOOLEAN DEFAULT FALSE;
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS checkin_token UUID DEFAULT gen_random_uuid();
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS feedback_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_registration_slots_checkin_token ON registration_slots(checkin_token);

-- 2. NEW TABLES
-- =====================================================

-- Event templates
CREATE TABLE IF NOT EXISTS event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  slot_config JSONB NOT NULL,
  default_settings JSONB,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES shift_slots(id) NOT NULL,
  event_id UUID REFERENCES events(id) NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  UNIQUE(slot_id, phone)
);

-- Shift reports (Sales)
CREATE TABLE IF NOT EXISTS shift_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_slot_id UUID REFERENCES registration_slots(id) NOT NULL,
  slot_id UUID REFERENCES shift_slots(id) NOT NULL,
  event_id UUID REFERENCES events(id) NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  report_data JSONB NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'submitted', -- 'submitted', 'verified', 'flagged'
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  UNIQUE(registration_slot_id)
);

-- Feedback questions
CREATE TABLE IF NOT EXISTS feedback_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'stars', 'rating', 'freeform'
  display_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback responses
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID, -- Optional legacy link
  question_id UUID REFERENCES feedback_questions(id) ON DELETE CASCADE NOT NULL,
  registration_slot_id UUID REFERENCES registration_slots(id) ON DELETE CASCADE,
  response TEXT,
  UNIQUE(registration_slot_id, question_id)
);

-- 3. RLS & INDEXES
-- =====================================================

ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public templates" ON event_templates FOR SELECT TO anon USING (true);
CREATE POLICY "Waitlist insert" ON waitlist FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Reports insert" ON shift_reports FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Feedback questions read" ON feedback_questions FOR SELECT TO anon USING (true);
CREATE POLICY "Feedback responses insert" ON feedback_responses FOR INSERT TO anon WITH CHECK (true);

-- Admin policies
CREATE POLICY "Admin all templates" ON event_templates FOR ALL TO service_role USING (true);
CREATE POLICY "Admin all waitlist" ON waitlist FOR ALL TO service_role USING (true);
CREATE POLICY "Admin all reports" ON shift_reports FOR ALL TO service_role USING (true);
CREATE POLICY "Admin all feedback q" ON feedback_questions FOR ALL TO service_role USING (true);
CREATE POLICY "Admin all feedback r" ON feedback_responses FOR ALL TO service_role USING (true);

-- 4. RPC FUNCTIONS
-- =====================================================

-- Enforce Check-in
CREATE OR REPLACE FUNCTION enforce_check_in(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg_slot RECORD;
  v_slot RECORD;
  v_event RECORD;
  v_open_at TIMESTAMPTZ;
  v_close_at TIMESTAMPTZ;
BEGIN
  SELECT rs.*, r.full_name INTO v_reg_slot
  FROM registration_slots rs JOIN registrations r ON r.id = rs.registration_id
  WHERE rs.checkin_token = p_token;
  
  IF v_reg_slot IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token', 'status', 'invalid'); END IF;
  IF v_reg_slot.checked_in_at IS NOT NULL THEN RETURN json_build_object('success', true, 'status', 'already_checked_in', 'checked_in_at', v_reg_slot.checked_in_at); END IF;
  
  SELECT * INTO v_slot FROM shift_slots WHERE id = v_reg_slot.slot_id;
  SELECT * INTO v_event FROM events WHERE id = v_slot.event_id;
  
  IF NOT COALESCE(v_event.checkin_required, true) THEN RETURN json_build_object('success', true, 'status', 'not_required'); END IF;
  
  IF v_slot.checkin_open_at IS NOT NULL AND v_slot.checkin_close_at IS NOT NULL THEN
    v_open_at := v_slot.checkin_open_at; v_close_at := v_slot.checkin_close_at;
  ELSE
    v_open_at := (v_slot.date || ' ' || v_slot.start_time)::TIMESTAMPTZ - (COALESCE(v_event.checkin_open_offset_minutes, 30) * INTERVAL '1 minute');
    v_close_at := (v_slot.date || ' ' || v_slot.start_time)::TIMESTAMPTZ + (COALESCE(v_event.checkin_close_offset_minutes, 120) * INTERVAL '1 minute');
  END IF;
  
  IF NOW() < v_open_at THEN RETURN json_build_object('success', false, 'status', 'too_early', 'opens_at', v_open_at); END IF;
  IF NOW() > v_close_at THEN RETURN json_build_object('success', false, 'status', 'too_late', 'closed_at', v_close_at); END IF;
  
  UPDATE registration_slots SET checked_in_at = NOW() WHERE id = v_reg_slot.id;
  RETURN json_build_object('success', true, 'status', 'checked_in', 'volunteer_name', v_reg_slot.full_name);
END; $$;

-- Join Waitlist
CREATE OR REPLACE FUNCTION join_waitlist(p_slot_id UUID, p_full_name TEXT, p_phone TEXT, p_email TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot RECORD; v_event RECORD; v_position INTEGER;
BEGIN
  SELECT * INTO v_slot FROM shift_slots WHERE id = p_slot_id;
  IF v_slot IS NULL THEN RETURN json_build_object('success', false, 'error', 'Slot not found'); END IF;
  SELECT * INTO v_event FROM events WHERE id = v_slot.event_id;
  IF NOT COALESCE(v_event.waitlist_enabled, false) THEN RETURN json_build_object('success', false, 'error', 'Waitlist not enabled'); END IF;
  IF v_slot.registered_count < v_slot.capacity THEN RETURN json_build_object('success', false, 'error', 'Slot still has availability'); END IF;
  
  SELECT COALESCE(MAX(position), 0) + 1 INTO v_position FROM waitlist WHERE slot_id = p_slot_id;
  INSERT INTO waitlist (slot_id, event_id, full_name, phone, email, position)
  VALUES (p_slot_id, v_slot.event_id, p_full_name, p_phone, p_email, v_position);
  RETURN json_build_object('success', true, 'position', v_position);
END; $$;

-- Submit Shift Report
CREATE OR REPLACE FUNCTION submit_shift_report(p_token UUID, p_report_data JSONB, p_notes TEXT DEFAULT NULL)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reg_slot RECORD;
BEGIN
  SELECT * INTO v_reg_slot FROM registration_slots WHERE checkin_token = p_token;
  IF v_reg_slot IS NULL THEN RETURN json_build_object('success', false, 'error', 'Invalid token'); END IF;
  IF EXISTS (SELECT 1 FROM shift_reports WHERE registration_slot_id = v_reg_slot.id) THEN 
    RETURN json_build_object('success', false, 'error', 'Report already submitted');
  END IF;
  
  INSERT INTO shift_reports (registration_slot_id, slot_id, event_id, report_data, notes)
  VALUES (v_reg_slot.id, v_reg_slot.slot_id, (SELECT event_id FROM shift_slots WHERE id = v_reg_slot.slot_id), p_report_data, p_notes);
  RETURN json_build_object('success', true);
END; $$;

-- Feedback Summary RPC
CREATE OR REPLACE FUNCTION get_feedback_summary(p_event_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_responses', (SELECT COUNT(DISTINCT rs.registration_id) FROM registration_slots rs JOIN shift_slots ss ON ss.id = rs.slot_id WHERE ss.event_id = p_event_id AND rs.feedback_submitted_at IS NOT NULL),
    'questions', (
      SELECT json_agg(q ORDER BY q.display_order)
      FROM (
        SELECT 
          fq.id, fq.question_text, fq.question_type, fq.display_order,
          CASE WHEN fq.question_type IN ('stars', 'rating') THEN (SELECT AVG((fr.response)::NUMERIC) FROM feedback_responses fr WHERE fr.question_id = fq.id) ELSE NULL END as average_score,
          CASE WHEN fq.question_type = 'freeform' THEN (SELECT json_agg(fr.response) FROM feedback_responses fr WHERE fr.question_id = fq.id AND fr.response IS NOT NULL AND fr.response != '') ELSE NULL END as text_responses
        FROM feedback_questions fq WHERE fq.event_id = p_event_id
      ) q
    )
  ) INTO v_result;
  RETURN v_result;
END; $$;

-- Grant permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 5. SEED TEMPLATES
-- =====================================================

INSERT INTO event_templates (name, category, description, icon, slot_config, default_settings) VALUES
('Thaipusam Festival', 'festival', 'Festival with marshalling and food service', '🎉', 
'{"slots": [{"name": "Route Marshal", "start": "08:00", "end": "12:00", "capacity": 10, "station": "Route"}]}', 
'{"feedback_enabled": true}'),
('Towel & Soap Sales', 'sales', 'Sales counter for towels and soap', '🧼',
'{"slots": [{"name": "Sales Counter", "start": "08:00", "end": "12:00", "capacity": 2, "station": "Sales Counter"}], "slot_type": "sales", "report_required": true, "sales_config": {"items": [{"name": "Towel", "unit_price": 5.00}, {"name": "Soap", "unit_price": 3.00}]}}',
'{"feedback_enabled": false}')
ON CONFLICT DO NOTHING;

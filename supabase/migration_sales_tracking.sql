-- =====================================================
-- SALES & INVENTORY TRACKING MIGRATION
-- =====================================================

-- Add slot type and sales configuration to shift_slots
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS slot_type TEXT DEFAULT 'standard';
-- slot_type: 'standard' (check-in only), 'sales' (requires report), 'inventory' (track quantities)

ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS sales_config JSONB;
-- Example: {"items": [{"name": "Towel", "unit_price": 5}, {"name": "Milk Packet", "unit_price": 2}]}

-- Per-slot reporting configuration
ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS report_required BOOLEAN DEFAULT FALSE;
-- If TRUE, at least one volunteer must submit a report for reconciliation

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

-- =====================================================
-- EVENT TEMPLATES - Add to migration_phase3_4.sql
-- =====================================================

-- Create event templates table
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

-- Enable RLS
ALTER TABLE event_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view templates" ON event_templates
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Service role manages templates" ON event_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed templates
INSERT INTO event_templates (name, category, description, icon, slot_config, default_settings) VALUES
-- 1. Thaipusam
('Thaipusam Multi-Day Festival', 'festival', 'Multi-day festival with route marshals, food service, and crowd control', '🎉', 
'{"slots": [
  {"name": "Route Marshal - Morning", "start": "06:00", "end": "12:00", "capacity": 15, "station": "Route"},
  {"name": "Route Marshal - Afternoon", "start": "12:00", "end": "18:00", "capacity": 12, "station": "Route"},
  {"name": "Route Marshal - Evening", "start": "18:00", "end": "00:00", "capacity": 10, "station": "Route"},
  {"name": "Food Service Counter", "start": "11:00", "end": "14:00", "capacity": 10, "station": "Food"},
  {"name": "Food Service Counter - Evening", "start": "17:00", "end": "20:00", "capacity": 10, "station": "Food"},
  {"name": "Temple Setup Crew", "start": "05:00", "end": "09:00", "capacity": 8, "station": "Setup"},
  {"name": "Crowd Control", "start": "10:00", "end": "16:00", "capacity": 12, "station": "Crowd"},
  {"name": "First Aid Station", "start": "08:00", "end": "20:00", "capacity": 4, "station": "First Aid"},
  {"name": "Cleanup Crew", "start": "22:00", "end": "01:00", "capacity": 8, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": true, "paused": false}'),

-- 2. Pongal
('Pongal Celebration', 'festival', 'Single-day Pongal celebration with cultural programs', '🍚',
'{"slots": [
  {"name": "Decoration Setup", "start": "07:00", "end": "09:00", "capacity": 8, "station": "Decoration"},
  {"name": "Cultural Program Coordinators", "start": "09:00", "end": "14:00", "capacity": 5, "station": "Programs"},
  {"name": "Food Servers - Shift 1", "start": "11:00", "end": "13:00", "capacity": 10, "station": "Food Service"},
  {"name": "Food Servers - Shift 2", "start": "13:00", "end": "15:00", "capacity": 10, "station": "Food Service"},
  {"name": "Photography Team", "start": "10:00", "end": "16:00", "capacity": 2, "station": "Media"},
  {"name": "Cleanup Crew", "start": "15:00", "end": "17:00", "capacity": 8, "station": "Cleanup"}
]}',
'{"checkin_required": false, "feedback_enabled": true, "certificates_enabled": false, "paused": false}'),

-- 3. Deepavali
('Deepavali Celebration', 'festival', 'Festival of lights with oil lamps and pooja', '🪔',
'{"slots": [
  {"name": "Decoration Team", "start": "08:00", "end": "12:00", "capacity": 10, "station": "Decoration"},
  {"name": "Oil Lamp Setup", "start": "10:00", "end": "12:00", "capacity": 6, "station": "Lamps"},
  {"name": "Pooja Assistants", "start": "17:00", "end": "21:00", "capacity": 8, "station": "Ceremony"},
  {"name": "Sweets Distribution", "start": "18:00", "end": "20:00", "capacity": 8, "station": "Distribution"},
  {"name": "Photography", "start": "16:00", "end": "21:00", "capacity": 2, "station": "Media"},
  {"name": "Cleanup Crew", "start": "21:00", "end": "22:00", "capacity": 6, "station": "Cleanup"}
]}',
'{"checkin_required": false, "feedback_enabled": true, "certificates_enabled": false, "paused": false}'),

-- 4. Vegetable Distribution
('Pre-Festival Vegetable Distribution', 'distribution', 'Organize and distribute vegetables to community', '🥬',
'{"slots": [
  {"name": "Delivery Receiving Team", "start": "07:00", "end": "09:00", "capacity": 4, "station": "Receiving"},
  {"name": "Vegetable Sorters", "start": "07:30", "end": "10:00", "capacity": 12, "station": "Sorting"},
  {"name": "Registration Desk Staff", "start": "09:30", "end": "16:00", "capacity": 3, "station": "Registration"},
  {"name": "Queue Marshals", "start": "09:30", "end": "16:00", "capacity": 4, "station": "Queue"},
  {"name": "Distribution Counter - Shift 1", "start": "10:00", "end": "13:00", "capacity": 15, "station": "Distribution"},
  {"name": "Distribution Counter - Shift 2", "start": "13:00", "end": "16:00", "capacity": 15, "station": "Distribution"},
  {"name": "Bag Packers", "start": "09:30", "end": "16:00", "capacity": 6, "station": "Packing"},
  {"name": "Cleanup Crew", "start": "16:00", "end": "17:00", "capacity": 8, "station": "Cleanup"}
]}',
'{"checkin_required": false, "feedback_enabled": false, "certificates_enabled": false, "paused": false}'),

-- 5. Palagaram Distribution
('Palagaram Distribution', 'distribution', 'Package and distribute traditional sweets/snacks', '🍬',
'{"slots": [
  {"name": "Packaging Team", "start": "08:00", "end": "11:00", "capacity": 8, "station": "Packaging"},
  {"name": "Quality Checkers", "start": "09:00", "end": "11:00", "capacity": 3, "station": "QC"},
  {"name": "Labeling Team", "start": "09:30", "end": "11:00", "capacity": 4, "station": "Labeling"},
  {"name": "Distribution Counter", "start": "11:00", "end": "14:00", "capacity": 12, "station": "Distribution"},
  {"name": "Cleanup Crew", "start": "14:00", "end": "15:00", "capacity": 6, "station": "Cleanup"}
]}',
'{"checkin_required": false, "feedback_enabled": false, "certificates_enabled": false, "paused": false}'),

-- 6. Annadhanam
('Annadhanam (Food Service)', 'food_service', 'Free meal service to community', '🍽️',
'{"slots": [
  {"name": "Kitchen Prep Team", "start": "08:00", "end": "11:00", "capacity": 8, "station": "Kitchen"},
  {"name": "Cooking Assistants", "start": "09:00", "end": "11:00", "capacity": 4, "station": "Kitchen"},
  {"name": "Serving Counter Staff", "start": "11:00", "end": "13:00", "capacity": 10, "station": "Serving"},
  {"name": "Plate/Utensil Washers", "start": "12:00", "end": "14:30", "capacity": 6, "station": "Washing"},
  {"name": "Kitchen Cleanup", "start": "13:30", "end": "14:30", "capacity": 4, "station": "Cleanup"}
]}',
'{"checkin_required": false, "feedback_enabled": false, "certificates_enabled": false, "paused": false}'),

-- 7. Heritage Walk
('Spiritual/Heritage Walk (7km)', 'wellness', 'Community wellness walk with marshals and support', '🚶',
'{"slots": [
  {"name": "Registration Desk", "start": "07:00", "end": "08:30", "capacity": 3, "station": "Registration"},
  {"name": "Route Marshal - Start Point", "start": "08:00", "end": "09:00", "capacity": 2, "station": "Route"},
  {"name": " Route Marshal - Mid Point", "start": "08:30", "end": "11:00", "capacity": 3, "station": "Route"},
  {"name": "Route Marshal - End Point", "start": "09:30", "end": "11:30", "capacity": 2, "station": "Route"},
  {"name": "First Aid Team", "start": "08:00", "end": "12:00", "capacity": 2, "station": "First Aid"},
  {"name": "Water Station 1", "start": "08:30", "end": "11:00", "capacity": 2, "station": "Refreshments"},
  {"name": "Water Station 2", "start": "09:00", "end": "11:30", "capacity": 2, "station": "Refreshments"},
  {"name": "Lunch Servers", "start": "11:00", "end": "13:00", "capacity": 8, "station": "Food"},
  {"name": "Photography", "start": "08:00", "end": "13:00", "capacity": 2, "station": "Media"},
  {"name": "Cleanup", "start": "13:00", "end": "14:00", "capacity": 4, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": false, "paused": false}'),

-- 8. Sports Day
('Community Sports Day', 'wellness', 'Sports event with referees and support staff', '⚽',
'{"slots": [
  {"name": "Registration Desk", "start": "08:00", "end": "10:00", "capacity": 4, "station": "Registration"},
  {"name": "Referees/Umpires", "start": "09:00", "end": "17:00", "capacity": 12, "station": "Officiating"},
  {"name": "First Aid", "start": "08:00", "end": "18:00", "capacity": 2, "station": "First Aid"},
  {"name": "Water/Snack Station", "start": "08:00", "end": "18:00", "capacity": 4, "station": "Refreshments"},
  {"name": "Lunch Servers", "start": "12:00", "end": "14:00", "capacity": 6, "station": "Food"},
  {"name": "Photography", "start": "09:00", "end": "17:00", "capacity": 2, "station": "Media"},
  {"name": "Prize Distribution Crew", "start": "17:00", "end": "18:00", "capacity": 4, "station": "Awards"},
  {"name": "Equipment Setup", "start": "07:00", "end": "09:00", "capacity": 6, "station": "Setup"},
  {"name": "Equipment Pack-up", "start": "17:00", "end": "18:00", "capacity": 6, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": true, "paused": false}');

-- RPC to apply template to event
CREATE OR REPLACE FUNCTION apply_event_template(
  p_event_id UUID,
  p_template_id UUID,
  p_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_slot JSONB;
  v_created_count INT := 0;
BEGIN
  -- Get template
  SELECT * INTO v_template FROM event_templates WHERE id = p_template_id;
  
  IF v_template IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Template not found');
  END IF;
  
  -- Create slots from template
  FOR v_slot IN SELECT * FROM jsonb_array_elements(v_template.slot_config->'slots')
  LOOP
    INSERT INTO shift_slots (
      event_id,
      date,
      day_of_week,
      shift_name,
      start_time,
      end_time,
      capacity,
      registered_count,
      station
    )
    VALUES (
      p_event_id,
      p_date,
      TO_CHAR(p_date, 'Day'),
      v_slot->>'name',
      (v_slot->>'start')::TIME,
      (v_slot->>'end')::TIME,
      (v_slot->>'capacity')::INT,
      0,
      v_slot->>'station'
    );
    
    v_created_count := v_created_count + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'created_count', v_created_count);
END;
$$;

GRANT EXECUTE ON FUNCTION apply_event_template(UUID, UUID, DATE) TO service_role;

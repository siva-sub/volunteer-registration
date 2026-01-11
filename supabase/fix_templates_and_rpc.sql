-- Fix Templates and RPC

-- 1. Create RPC first (was missing)
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
      station,
      slot_type,
      sales_config,
      report_required
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
      v_slot->>'station',
      COALESCE(v_template.slot_config->>'slot_type', 'standard'),
      v_template.slot_config->'sales_config',
      COALESCE((v_template.slot_config->>'report_required')::BOOLEAN, false)
    );
    
    v_created_count := v_created_count + 1;
  END LOOP;
  
  RETURN json_build_object('success', true, 'created_count', v_created_count);
END;
$$;

GRANT EXECUTE ON FUNCTION apply_event_template(UUID, UUID, DATE) TO service_role;

-- 2. Waitlist Admin RPC
CREATE OR REPLACE FUNCTION admin_get_waitlist(
  p_password TEXT,
  p_event_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_password != 'temple2026' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN json_build_object(
    'success', true,
    'data', (
      SELECT json_agg(row_to_json(w))
      FROM (
        SELECT 
          wl.id,
          wl.full_name,
          wl.phone,
          wl.email,
          wl.position,
          wl.created_at,
          ss.date,
          ss.shift_name,
          ss.start_time,
          ss.end_time
        FROM waitlist wl
        JOIN shift_slots ss ON wl.slot_id = ss.id
        WHERE wl.event_id = p_event_id
        ORDER BY wl.position
      ) w
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_waitlist(TEXT, UUID) TO service_role;

-- 3. Reset Templates (Truncate and Re-seed)
TRUNCATE TABLE event_templates;

-- Insert all 16 templates
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
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": true, "paused": false}'),

-- 9. Pradosham (Bi-Monthly)
('Pradosham', 'festival', 'Bi-monthly prayer event with cleaning and pooja assistance', '🧘',
'{"slots": [
  {"name": "Temple Cleaning", "start": "07:00", "end": "10:00", "capacity": 5, "station": "Maintenance"},
  {"name": "Flower Decoration", "start": "08:00", "end": "10:00", "capacity": 3, "station": "Decoration"},
  {"name": "Pooja Assistance", "start": "10:00", "end": "13:00", "capacity": 4, "station": "Ceremony"},
  {"name": "Lunch Servers", "start": "12:00", "end": "14:00", "capacity": 6, "station": "Food"},
  {"name": "Cleanup Crew", "start": "14:00", "end": "16:00", "capacity": 4, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": false, "certificates_enabled": false, "paused": false}'),

-- 10. Pillayar Nombu
('Pillayar Nombu', 'festival', 'Special prasadam distribution event', '🧱',
'{"slots": [
  {"name": "Temple Setup", "start": "06:00", "end": "08:00", "capacity": 4, "station": "Setup"},
  {"name": "Pooja Assistance", "start": "08:00", "end": "12:00", "capacity": 6, "station": "Ceremony"},
  {"name": "Prasadam Packers", "start": "10:00", "end": "12:00", "capacity": 5, "station": "Kitchen"},
  {"name": "Prasadam Distribution", "start": "11:00", "end": "13:00", "capacity": 6, "station": "Distribution"},
  {"name": "Cleanup", "start": "13:00", "end": "14:00", "capacity": 4, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": false, "paused": false}'),

-- 11. Community Picnic
('Community Picnic', 'wellness', 'Outdoor social event with games and food', '🧺',
'{"slots": [
  {"name": "Site Setup", "start": "08:00", "end": "10:00", "capacity": 6, "station": "Setup"},
  {"name": "Registration Desk", "start": "09:00", "end": "11:00", "capacity": 3, "station": "Registration"},
  {"name": "Games Coordinators", "start": "10:00", "end": "14:00", "capacity": 8, "station": "Activities"},
  {"name": "Food Distribution", "start": "12:00", "end": "14:00", "capacity": 8, "station": "Food"},
  {"name": "Photography", "start": "10:00", "end": "15:00", "capacity": 2, "station": "Media"},
  {"name": "Cleanup Crew", "start": "14:00", "end": "16:00", "capacity": 8, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": false, "paused": false}'),

-- 12. Cultural Program
('Cultural Program', 'cultural', 'Evening performances and stage events', '🎭',
'{"slots": [
  {"name": "AV/Tech Setup", "start": "14:00", "end": "16:00", "capacity": 4, "station": "Tech"},
  {"name": "Sound Engineer", "start": "16:00", "end": "22:00", "capacity": 2, "station": "Tech"},
  {"name": "Lighting Operator", "start": "16:00", "end": "22:00", "capacity": 1, "station": "Tech"},
  {"name": "Ushers - Entry", "start": "16:00", "end": "18:30", "capacity": 6, "station": "Front of House"},
  {"name": "Stage Managers", "start": "18:00", "end": "21:00", "capacity": 3, "station": "Backstage"},
  {"name": "Photography/Video", "start": "18:00", "end": "21:00", "capacity": 2, "station": "Media"},
  {"name": "Cleanup", "start": "21:00", "end": "22:00", "capacity": 4, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": true, "paused": false}'),

-- 13. Women''s Day
('Women''s Day Celebration', 'cultural', 'Day-long event celebrating women with programs and lunch', '🌸',
'{"slots": [
  {"name": "Registration Desk", "start": "09:00", "end": "10:30", "capacity": 3, "station": "Registration"},
  {"name": "Program Coordinators", "start": "10:00", "end": "16:00", "capacity": 4, "station": "Programs"},
  {"name": "Lunch Servers", "start": "12:00", "end": "14:00", "capacity": 6, "station": "Food"},
  {"name": "Activity Leaders", "start": "14:00", "end": "16:00", "capacity": 4, "station": "Activities"},
  {"name": "Photography", "start": "09:00", "end": "16:00", "capacity": 2, "station": "Media"},
  {"name": "Cleanup", "start": "16:00", "end": "17:00", "capacity": 4, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": true, "paused": false}'),

-- 14. AGM
('Annual General Meeting (AGM)', 'admin', 'Administrative meeting support', '📅',
'{"slots": [
  {"name": "Registration Desk", "start": "09:00", "end": "10:00", "capacity": 2, "station": "Registration"},
  {"name": "AV/Presentation Support", "start": "09:30", "end": "13:30", "capacity": 2, "station": "Tech"},
  {"name": "Minute Taker", "start": "10:00", "end": "13:00", "capacity": 1, "station": "Admin"},
  {"name": "Lunch Servers", "start": "12:00", "end": "14:00", "capacity": 4, "station": "Food"},
  {"name": "Cleanup", "start": "14:00", "end": "15:00", "capacity": 3, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": false, "certificates_enabled": false, "paused": false}'),

-- 15. Temple Workday
('Temple Maintenance Workday', 'maintenance', 'General cleaning, gardening, and painting day', '🛠️',
'{"slots": [
  {"name": "Temple Cleaners - Morning", "start": "08:00", "end": "12:00", "capacity": 10, "station": "Cleaning"},
  {"name": "Temple Cleaners - Afternoon", "start": "13:00", "end": "17:00", "capacity": 10, "station": "Cleaning"},
  {"name": "Garden Team - Morning", "start": "08:00", "end": "12:00", "capacity": 5, "station": "Gardening"},
  {"name": "Garden Team - Afternoon", "start": "13:00", "end": "17:00", "capacity": 5, "station": "Gardening"},
  {"name": "Painting Crew", "start": "08:00", "end": "17:00", "capacity": 6, "station": "Maintenance"}
]}',
'{"checkin_required": true, "feedback_enabled": false, "certificates_enabled": true, "paused": false}'),

-- 16. Overnight Retreat
('Overnight Retreat (2 Days)', 'multi-day', 'Weekend retreat with overnight stay', '⛺',
'{"slots": [
  {"name": "Day 1 Registration", "start": "14:00", "end": "17:00", "capacity": 4, "station": "Registration"},
  {"name": "Day 1 Activity Coordinators", "start": "17:00", "end": "21:00", "capacity": 6, "station": "Activities"},
  {"name": "Day 1 Kitchen Staff - Dinner", "start": "16:00", "end": "20:00", "capacity": 6, "station": "Kitchen"},
  {"name": "Day 1 Night Supervisors", "start": "21:00", "end": "07:00", "capacity": 3, "station": "Security"},
  {"name": "Day 2 Kitchen Staff - Breakfast", "start": "06:30", "end": "09:00", "capacity": 4, "station": "Kitchen"},
  {"name": "Day 2 Morning Activity Leaders", "start": "07:00", "end": "12:00", "capacity": 6, "station": "Activities"},
  {"name": "Day 2 Kitchen Staff - Lunch", "start": "11:00", "end": "13:00", "capacity": 4, "station": "Kitchen"},
  {"name": "Day 2 Checkout & Cleanup", "start": "12:00", "end": "15:00", "capacity": 8, "station": "Cleanup"}
]}',
'{"checkin_required": true, "feedback_enabled": true, "certificates_enabled": true, "paused": false}');

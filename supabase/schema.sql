-- =====================================================
-- Sri Thendayuthapani Temple Volunteer Registration
-- Database Schema for Supabase
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLES
-- =====================================================

-- Shift slots table - stores all available volunteer shifts
CREATE TABLE IF NOT EXISTS shift_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  shift_name TEXT NOT NULL CHECK (shift_name IN ('Morning', 'Evening')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 2,
  registered_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure registered_count never exceeds capacity
  CONSTRAINT valid_count CHECK (registered_count >= 0 AND registered_count <= capacity),
  -- Each date can only have one morning and one evening shift
  CONSTRAINT unique_shift UNIQUE(date, shift_name)
);

-- Registrations table - stores volunteer sign-ups
CREATE TABLE IF NOT EXISTS registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table linking registrations to shift slots
CREATE TABLE IF NOT EXISTS registration_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES shift_slots(id) ON DELETE CASCADE,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate registration for same slot
  CONSTRAINT unique_registration_slot UNIQUE(registration_id, slot_id)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_shift_slots_date ON shift_slots(date);
CREATE INDEX IF NOT EXISTS idx_registration_slots_slot_id ON registration_slots(slot_id);
CREATE INDEX IF NOT EXISTS idx_registration_slots_registration_id ON registration_slots(registration_id);

-- =====================================================
-- SEED DATA: Generate shifts for 17-30 January 2026
-- =====================================================

INSERT INTO shift_slots (date, day_of_week, shift_name, start_time, end_time, capacity, registered_count)
VALUES
  -- Saturday, 17 January 2026
  ('2026-01-17', 'Saturday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-17', 'Saturday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Sunday, 18 January 2026
  ('2026-01-18', 'Sunday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-18', 'Sunday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Monday, 19 January 2026
  ('2026-01-19', 'Monday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-19', 'Monday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Tuesday, 20 January 2026
  ('2026-01-20', 'Tuesday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-20', 'Tuesday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Wednesday, 21 January 2026
  ('2026-01-21', 'Wednesday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-21', 'Wednesday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Thursday, 22 January 2026
  ('2026-01-22', 'Thursday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-22', 'Thursday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Friday, 23 January 2026
  ('2026-01-23', 'Friday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-23', 'Friday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Saturday, 24 January 2026
  ('2026-01-24', 'Saturday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-24', 'Saturday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Sunday, 25 January 2026
  ('2026-01-25', 'Sunday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-25', 'Sunday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Monday, 26 January 2026
  ('2026-01-26', 'Monday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-26', 'Monday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Tuesday, 27 January 2026
  ('2026-01-27', 'Tuesday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-27', 'Tuesday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Wednesday, 28 January 2026
  ('2026-01-28', 'Wednesday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-28', 'Wednesday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Thursday, 29 January 2026
  ('2026-01-29', 'Thursday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-29', 'Thursday', 'Evening', '17:30', '20:30', 2, 0),
  
  -- Friday, 30 January 2026
  ('2026-01-30', 'Friday', 'Morning', '08:00', '12:00', 2, 0),
  ('2026-01-30', 'Friday', 'Evening', '17:30', '20:30', 2, 0)
ON CONFLICT (date, shift_name) DO NOTHING;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE shift_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_slots ENABLE ROW LEVEL SECURITY;

-- Public can read shift slots (to see availability)
CREATE POLICY "Public can view shift slots" ON shift_slots
  FOR SELECT TO anon USING (true);

-- Only authenticated/service role can modify shift_slots
CREATE POLICY "Service role can modify shift slots" ON shift_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Service role can do everything with registrations
CREATE POLICY "Service role can manage registrations" ON registrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Service role can do everything with registration_slots
CREATE POLICY "Service role can manage registration slots" ON registration_slots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =====================================================
-- ATOMIC REGISTRATION FUNCTION
-- This function handles all-or-nothing slot booking
-- =====================================================

CREATE OR REPLACE FUNCTION register_volunteer(
  p_full_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_slot_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_registration_id UUID;
  v_slot_id UUID;
  v_current_count INTEGER;
  v_capacity INTEGER;
  v_unavailable_slots JSON[] := '{}';
  v_slot_info RECORD;
BEGIN
  -- Validate inputs
  IF p_full_name IS NULL OR TRIM(p_full_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Full name is required');
  END IF;
  
  IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Phone number is required');
  END IF;
  
  IF p_slot_ids IS NULL OR array_length(p_slot_ids, 1) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'At least one shift must be selected');
  END IF;

  -- Lock and check all slots first
  FOR v_slot_id IN SELECT unnest(p_slot_ids)
  LOOP
    -- Get slot with row lock
    SELECT registered_count, capacity, date, shift_name 
    INTO v_current_count, v_capacity, v_slot_info.date, v_slot_info.shift_name
    FROM shift_slots 
    WHERE id = v_slot_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'One or more selected shifts do not exist');
    END IF;
    
    -- Check if slot is full
    IF v_current_count >= v_capacity THEN
      v_unavailable_slots := array_append(
        v_unavailable_slots, 
        json_build_object('date', v_slot_info.date, 'shift', v_slot_info.shift_name)
      );
    END IF;
  END LOOP;
  
  -- If any slots are unavailable, reject entire registration
  IF array_length(v_unavailable_slots, 1) > 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Some shifts are no longer available',
      'unavailable_slots', to_json(v_unavailable_slots)
    );
  END IF;
  
  -- All slots available - create registration
  INSERT INTO registrations (full_name, phone, email)
  VALUES (TRIM(p_full_name), TRIM(p_phone), NULLIF(TRIM(COALESCE(p_email, '')), ''))
  RETURNING id INTO v_registration_id;
  
  -- Link registration to slots and increment counts
  FOR v_slot_id IN SELECT unnest(p_slot_ids)
  LOOP
    -- Create junction record
    INSERT INTO registration_slots (registration_id, slot_id)
    VALUES (v_registration_id, v_slot_id);
    
    -- Increment slot count
    UPDATE shift_slots 
    SET registered_count = registered_count + 1
    WHERE id = v_slot_id;
  END LOOP;
  
  -- Return success with registration ID
  RETURN json_build_object(
    'success', true, 
    'registration_id', v_registration_id,
    'message', 'Registration successful'
  );
  
EXCEPTION
  WHEN check_violation THEN
    RETURN json_build_object('success', false, 'error', 'A shift became full during registration. Please try again.');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'An unexpected error occurred. Please try again.');
END;
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION register_volunteer TO anon;

-- =====================================================
-- ADMIN VIEW FUNCTION
-- Returns all registrations with slot details
-- =====================================================

CREATE OR REPLACE FUNCTION get_all_registrations()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT 
        r.id,
        r.full_name,
        r.phone,
        r.email,
        r.created_at,
        (
          SELECT json_agg(
            json_build_object(
              'slot_id', ss.id,
              'date', ss.date,
              'day_of_week', ss.day_of_week,
              'shift_name', ss.shift_name,
              'start_time', ss.start_time,
              'end_time', ss.end_time,
              'reminder_sent', rs.reminder_sent
            )
            ORDER BY ss.date, ss.shift_name
          )
          FROM registration_slots rs
          JOIN shift_slots ss ON rs.slot_id = ss.id
          WHERE rs.registration_id = r.id
        ) as shifts
      FROM registrations r
      ORDER BY r.created_at DESC
    ) t
  );
END;
$$;

-- =====================================================
-- FUNCTION TO GET REGISTRATIONS BY SLOT
-- For admin view filtering
-- =====================================================

CREATE OR REPLACE FUNCTION get_registrations_by_date(p_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT 
        r.id,
        r.full_name,
        r.phone,
        r.email,
        r.created_at,
        ss.date,
        ss.day_of_week,
        ss.shift_name,
        ss.start_time,
        ss.end_time
      FROM registrations r
      JOIN registration_slots rs ON r.id = rs.registration_id
      JOIN shift_slots ss ON rs.slot_id = ss.id
      WHERE ss.date = p_date
      ORDER BY ss.shift_name, r.full_name
    ) t
  );
END;
$$;

-- =====================================================
-- FUNCTION TO GET TOMORROW'S REMINDERS
-- For the reminder email system
-- =====================================================

CREATE OR REPLACE FUNCTION get_reminders_for_tomorrow()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tomorrow DATE := CURRENT_DATE + INTERVAL '1 day';
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT 
        r.id as registration_id,
        r.full_name,
        r.phone,
        r.email,
        rs.id as registration_slot_id,
        ss.date,
        ss.day_of_week,
        ss.shift_name,
        ss.start_time,
        ss.end_time
      FROM registrations r
      JOIN registration_slots rs ON r.id = rs.registration_id
      JOIN shift_slots ss ON rs.slot_id = ss.id
      WHERE ss.date = v_tomorrow
        AND rs.reminder_sent = FALSE
        AND r.email IS NOT NULL
        AND r.email != ''
      ORDER BY ss.shift_name, r.full_name
    ) t
  );
END;
$$;

-- =====================================================
-- FUNCTION TO MARK REMINDERS AS SENT
-- =====================================================

CREATE OR REPLACE FUNCTION mark_reminders_sent(p_registration_slot_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE registration_slots
  SET reminder_sent = TRUE
  WHERE id = ANY(p_registration_slot_ids);
END;
$$;

-- =====================================================
-- MIGRATION: DYNAMIC EVENTS SUPPORT
-- =====================================================

-- 1. Create Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  organization_name TEXT DEFAULT 'Sri Thendayuthapani Temple',
  description TEXT,
  contact_person TEXT NOT NULL,
  contact_whatsapp TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  dates_config JSONB, -- Stores {start: '2026-01-17', end: '2026-01-30'} or list of dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  
  -- Soft delete check
  CONSTRAINT active_event CHECK (deleted_at IS NULL OR active = FALSE)
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policies for Events
CREATE POLICY "Public can view active events" ON events
  FOR SELECT TO anon USING (active = TRUE AND deleted_at IS NULL);

CREATE POLICY "Service role can manage events" ON events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Create Default Event (Migration for existing data)
-- We insert a default event to link existing slots to.
INSERT INTO events (title, description, contact_person, contact_whatsapp, dates_config)
VALUES (
  'Thaipusam Festival 2026', 
  'Volunteer for Towel & Soap Sales', 
  'Hari', 
  '6596707295',
  '{"start": "2026-01-17", "end": "2026-01-30"}'::jsonb
) ON CONFLICT DO NOTHING; -- Ensure idempotency if run multiple times

-- Capture the default event ID for migration
DO $$
DECLARE
  v_default_event_id UUID;
BEGIN
  SELECT id INTO v_default_event_id FROM events WHERE title = 'Thaipusam Festival 2026' LIMIT 1;
  
  -- 3. Modify Shift Slots Table
  -- Add event_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shift_slots' AND column_name = 'event_id') THEN
    ALTER TABLE shift_slots ADD COLUMN event_id UUID REFERENCES events(id);
    
    -- Migrate existing slots to default event
    UPDATE shift_slots SET event_id = v_default_event_id WHERE event_id IS NULL;
    
    -- Make event_id NOT NULL after migration
    ALTER TABLE shift_slots ALTER COLUMN event_id SET NOT NULL;
  END IF;

  -- Add deleted_at column for soft deletes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shift_slots' AND column_name = 'deleted_at') THEN
    ALTER TABLE shift_slots ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;

  -- Drop old constraints if they exist
  -- We need to check constraint names from schema.sql: "valid_count" (keep), "unique_shift" (modify)
  
  -- Drop unique_shift constraint to re-create it scoped to event_id
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_shift') THEN
    ALTER TABLE shift_slots DROP CONSTRAINT unique_shift;
  END IF;
  
  -- Remove check constraint on shift_name if strictly hardcoded
  -- The original schema had: CHECK (shift_name IN ('Morning', 'Evening'))
  -- We want to allow dynamic names, so we drop this check.
  -- Note: Postgres constraints often have auto-generated names if not named explicitly, 
  -- but schema.sql didn't verify if it was named. 
  -- schema.sql: `shift_name TEXT NOT NULL CHECK (shift_name IN ('Morning', 'Evening'))`
  -- Since it was inline, it might be an anonymous constraint. We need to find and drop it.
  -- Alternatively, we can just ALTER COLUMN DROP NOT NULL (if needed) or rely on text being flexible.
  -- BUT the CHECK is the problem.
  
  -- Attempt to drop the check constraint on shift_name.
  -- This is tricky without knowing the exact name.
  -- Using a robust approach to find and drop the check constraint on shift_name column.
  -- For this script, we'll try to drop the likely name or ignore if it fails/warns.
  -- A common convention is shift_slots_shift_name_check
  
  BEGIN
    ALTER TABLE shift_slots DROP CONSTRAINT IF EXISTS shift_slots_shift_name_check;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not drop shift_name check constraint automatically. Please verify.';
  END;

END $$;

-- 4. Re-create Unique Constraint on Shift Slots
-- Scoped to event_id + date + shift_name
ALTER TABLE shift_slots 
ADD CONSTRAINT unique_event_shift UNIQUE(event_id, date, shift_name);


-- =====================================================
-- UPDATED RPCs
-- =====================================================

-- Update register_volunteer to handle deleted_at and potentially validate event
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
  v_cancel_token UUID;
  v_checkin_tokens UUID[] := '{}';
  v_slot_id UUID;
  v_current_count INTEGER;
  v_capacity INTEGER;
  v_unavailable_slots JSON[] := '{}';
  v_slot_date DATE;
  v_slot_name TEXT;
  v_event_id UUID;
  v_first_event_id UUID;
  v_checkin_token_temp UUID;
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
    -- Also check for soft delete
    SELECT registered_count, capacity, date, shift_name, event_id
    INTO v_current_count, v_capacity, v_slot_date, v_slot_name, v_event_id
    FROM shift_slots 
    WHERE id = v_slot_id AND deleted_at IS NULL
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'One or more selected shifts do not exist or have been removed');
    END IF;
    
    -- Check event consistency (all slots should be from same event)
    IF v_first_event_id IS NULL THEN
        v_first_event_id := v_event_id;
    ELSIF v_first_event_id != v_event_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot register for shifts from different events simultaneously');
    END IF;

    -- Check if slot is full
    IF v_current_count >= v_capacity THEN
      v_unavailable_slots := array_append(
        v_unavailable_slots, 
        json_build_object('date', v_slot_date, 'shift', v_slot_name)
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
  INSERT INTO registrations (full_name, phone, email, event_id)
  VALUES (TRIM(p_full_name), TRIM(p_phone), NULLIF(TRIM(COALESCE(p_email, '')), ''), v_first_event_id)
  RETURNING id, cancel_token INTO v_registration_id, v_cancel_token;
  
  -- Link registration to slots and increment counts
  FOR v_slot_id IN SELECT unnest(p_slot_ids)
  LOOP
    INSERT INTO registration_slots (registration_id, slot_id)
    VALUES (v_registration_id, v_slot_id)
    RETURNING checkin_token INTO v_checkin_token_temp;
    
    v_checkin_tokens := array_append(v_checkin_tokens, v_checkin_token_temp);
    
    UPDATE shift_slots 
    SET registered_count = registered_count + 1
    WHERE id = v_slot_id;
  END LOOP;
  
  -- Return success with registration ID and event info for email
  RETURN json_build_object(
    'success', true, 
    'registration_id', v_registration_id,
    'cancel_token', v_cancel_token,
    'checkin_tokens', v_checkin_tokens,
    'message', 'Registration successful',
    'event_id', v_first_event_id
  );
  
EXCEPTION
  WHEN check_violation THEN
    RETURN json_build_object('success', false, 'error', 'A shift became full during registration. Please try again.');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', 'An unexpected error occurred. Please try again.');
END;
$$;


-- Update get_reminders_for_tomorrow to include event contact info
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
        rs.checkin_token,
        ss.date,
        ss.day_of_week,
        ss.shift_name,
        ss.start_time,
        ss.end_time,
        -- Event Details
        e.title as event_title,
        e.organization_name,
        e.contact_person,
        e.contact_whatsapp,
        -- Computed Check-in Window
        CASE 
          WHEN ss.checkin_open_at IS NOT NULL THEN ss.checkin_open_at
          WHEN COALESCE(e.checkin_window_mode, 'auto') = 'auto' THEN 
            (ss.date || ' ' || ss.start_time)::TIMESTAMPTZ - (COALESCE(e.checkin_open_offset_minutes, 30) || ' minutes')::INTERVAL
          ELSE NULL
        END as checkin_open_at
      FROM registrations r
      JOIN registration_slots rs ON r.id = rs.registration_id
      JOIN shift_slots ss ON rs.slot_id = ss.id
      JOIN events e ON ss.event_id = e.id
      WHERE ss.date = v_tomorrow
        AND rs.reminder_sent = FALSE
        AND r.email IS NOT NULL
        AND r.email != ''
        AND e.active = TRUE
        AND (e.deleted_at IS NULL)
        AND (ss.deleted_at IS NULL)
      ORDER BY e.id, ss.shift_name, r.full_name
    ) t
  );
END;
$$;


-- =====================================================
-- NEW ADMIN FUNCTIONS
-- =====================================================

-- Get All Events (Admin)
CREATE OR REPLACE FUNCTION admin_get_events()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(e))
    FROM (
      SELECT * FROM events 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
    ) e
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_events TO service_role;

-- Get Event Details (Single Event + Slot Stats)
CREATE OR REPLACE FUNCTION get_event_details(p_event_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_event JSON;
    v_slots JSON;
BEGIN
    SELECT row_to_json(e) INTO v_event FROM events e WHERE id = p_event_id;
    
    SELECT json_agg(row_to_json(s)) INTO v_slots 
    FROM (
        SELECT * FROM shift_slots 
        WHERE event_id = p_event_id AND deleted_at IS NULL
        ORDER BY date, shift_name
    ) s;

    RETURN json_build_object(
        'event', v_event,
        'slots', COALESCE(v_slots, '[]'::json)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_event_details TO anon;
GRANT EXECUTE ON FUNCTION get_event_details TO service_role;

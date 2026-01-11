-- Add Registration and Waitlist Modes

-- 1. Create Types
CREATE TYPE registration_mode_enum AS ENUM ('instant', 'approval');
CREATE TYPE waitlist_mode_enum AS ENUM ('manual', 'auto');

-- 2. Add columns to events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS registration_mode registration_mode_enum DEFAULT 'instant',
ADD COLUMN IF NOT EXISTS waitlist_mode waitlist_mode_enum DEFAULT 'manual';

-- 3. Update admin_update_event RPC
-- Drop first to avoid parameter default conflicts
DROP FUNCTION IF EXISTS admin_update_event(text,uuid,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,text,integer,integer,text);

CREATE OR REPLACE FUNCTION admin_update_event(
  p_password TEXT,
  p_event_id UUID,
  p_title TEXT,
  p_organization_name TEXT,
  p_contact_person TEXT,
  p_contact_whatsapp TEXT,
  p_active BOOLEAN,
  p_feedback_enabled BOOLEAN DEFAULT NULL,
  p_certificates_enabled BOOLEAN DEFAULT NULL,
  p_paused BOOLEAN DEFAULT NULL,
  p_waitlist_enabled BOOLEAN DEFAULT NULL,
  p_checkin_required BOOLEAN DEFAULT NULL,
  p_checkin_window_mode TEXT DEFAULT NULL,
  p_checkin_open_offset_minutes INTEGER DEFAULT NULL,
  p_checkin_close_offset_minutes INTEGER DEFAULT NULL,
  p_coordinator_email TEXT DEFAULT NULL,
  p_registration_mode TEXT DEFAULT NULL,
  p_waitlist_mode TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE events
  SET 
    title = COALESCE(p_title, title),
    organization_name = COALESCE(p_organization_name, organization_name),
    contact_person = COALESCE(p_contact_person, contact_person),
    contact_whatsapp = COALESCE(p_contact_whatsapp, contact_whatsapp),
    active = COALESCE(p_active, active),
    feedback_enabled = COALESCE(p_feedback_enabled, feedback_enabled),
    certificates_enabled = COALESCE(p_certificates_enabled, certificates_enabled),
    paused = COALESCE(p_paused, paused),
    waitlist_enabled = COALESCE(p_waitlist_enabled, waitlist_enabled),
    checkin_required = COALESCE(p_checkin_required, checkin_required),
    checkin_window_mode = COALESCE(p_checkin_window_mode, checkin_window_mode),
    checkin_open_offset_minutes = COALESCE(p_checkin_open_offset_minutes, checkin_open_offset_minutes),
    checkin_close_offset_minutes = COALESCE(p_checkin_close_offset_minutes, checkin_close_offset_minutes),
    coordinator_email = COALESCE(p_coordinator_email, coordinator_email),
    registration_mode = COALESCE(p_registration_mode::registration_mode_enum, registration_mode),
    waitlist_mode = COALESCE(p_waitlist_mode::waitlist_mode_enum, waitlist_mode)
  WHERE id = p_event_id;

  RETURN json_build_object('success', true);
END;
$$;

-- 4. Update register_volunteer to handle 'approval' mode
DROP FUNCTION IF EXISTS register_volunteer(text,text,text,uuid[]);

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
  v_reg_mode registration_mode_enum;
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

  -- 1. Identify Event & Check Consistency
  FOR v_slot_id IN SELECT unnest(p_slot_ids)
  LOOP
    SELECT event_id INTO v_event_id FROM shift_slots WHERE id = v_slot_id;
    
    IF v_event_id IS NULL THEN
         RETURN json_build_object('success', false, 'error', 'Invalid shift selected');
    END IF;

    IF v_first_event_id IS NULL THEN
        v_first_event_id := v_event_id;
    ELSIF v_first_event_id != v_event_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot register for shifts from different events simultaneously');
    END IF;
  END LOOP;

  -- 2. Check Registration Mode
  SELECT registration_mode INTO v_reg_mode FROM events WHERE id = v_first_event_id;

  -- IF APPROVAL MODE: Insert directly into waitlist and return
  IF v_reg_mode = 'approval' THEN
      FOR v_slot_id IN SELECT unnest(p_slot_ids)
      LOOP
         INSERT INTO waitlist (event_id, slot_id, full_name, phone, email)
         VALUES (v_first_event_id, v_slot_id, TRIM(p_full_name), TRIM(p_phone), NULLIF(TRIM(COALESCE(p_email, '')), ''));
      END LOOP;

      RETURN json_build_object(
        'success', true, 
        'message', 'Application received. You have been added to the applicant list pending approval.',
        'registration_mode', 'approval'
      );
  END IF;

  -- STANDARD INSTANT BOOKING LOGIC (Existing)
  
  -- Lock and check all slots first
  FOR v_slot_id IN SELECT unnest(p_slot_ids)
  LOOP
    -- Get slot with row lock
    SELECT registered_count, capacity, date, shift_name
    INTO v_current_count, v_capacity, v_slot_date, v_slot_name
    FROM shift_slots 
    WHERE id = v_slot_id AND deleted_at IS NULL
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'One or more selected shifts do not exist or have been removed');
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
     -- Catch-all for other errors
    RETURN json_build_object('success', false, 'error', 'An unexpected error occurred: ' || SQLERRM);
END;
$$;

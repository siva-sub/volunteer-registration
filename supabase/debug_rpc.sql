-- Update the function to expose the actual error message
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
    -- Debugging: Return the actual error message
    RETURN json_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

-- Admin Features: Manual Registration & Shift Leaders

-- 1. Add is_shift_leader column
ALTER TABLE registration_slots ADD COLUMN IF NOT EXISTS is_shift_leader BOOLEAN DEFAULT FALSE;

-- 2. Admin Create Registration (Manual Add)
CREATE OR REPLACE FUNCTION admin_create_registration(
  p_password TEXT,
  p_event_id UUID,
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
  v_registration_id UUID;
  v_reg_slot_id UUID;
  v_slot_capacity INT;
  v_slot_registered INT;
BEGIN
  -- Security Check
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Verify Slot Exists and get capacity (for logging/info, we override anyway)
  SELECT capacity, registered_count INTO v_slot_capacity, v_slot_registered
  FROM shift_slots WHERE id = p_slot_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Slot not found');
  END IF;

  -- Check if user exists for this event or create new
  -- Note: A user can register for multiple slots. 
  -- We assume standard logic: unique phone per event? Or just reuse if exists?
  -- Let's check if there is a registration for this phone + event
  SELECT id INTO v_registration_id
  FROM registrations 
  WHERE event_id = p_event_id AND phone = p_phone
  LIMIT 1;

  IF v_registration_id IS NULL THEN
      INSERT INTO registrations (event_id, full_name, phone, email)
      VALUES (p_event_id, p_full_name, p_phone, p_email)
      RETURNING id INTO v_registration_id;
  END IF;

  -- Assign to Slot
  -- Check if already assigned
  SELECT id INTO v_reg_slot_id FROM registration_slots 
  WHERE registration_id = v_registration_id AND slot_id = p_slot_id;

  IF v_reg_slot_id IS NOT NULL THEN
      RETURN json_build_object('success', false, 'error', 'User already registered for this slot');
  END IF;

  INSERT INTO registration_slots (registration_id, slot_id)
  VALUES (v_registration_id, p_slot_id);

  -- Update Count
  UPDATE shift_slots 
  SET registered_count = registered_count + 1
  WHERE id = p_slot_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Volunteer added successfully',
    'registration_id', v_registration_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Toggle Shift Leader
CREATE OR REPLACE FUNCTION admin_toggle_shift_leader(
  p_password TEXT,
  p_registration_id UUID,
  p_slot_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_state BOOLEAN;
BEGIN
  -- Security Check
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE registration_slots
  SET is_shift_leader = NOT COALESCE(is_shift_leader, FALSE)
  WHERE registration_id = p_registration_id AND slot_id = p_slot_id
  RETURNING is_shift_leader INTO v_new_state;

  IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Registration slot not found');
  END IF;

  RETURN json_build_object('success', true, 'is_leader', v_new_state);
END;
$$;

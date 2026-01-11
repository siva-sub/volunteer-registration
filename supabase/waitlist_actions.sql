-- Waitlist Management Actions

-- 1. Promote from Waitlist
CREATE OR REPLACE FUNCTION admin_promote_waitlist_entry(
  p_password TEXT,
  p_waitlist_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry RECORD;
  v_registration_id UUID;
  v_cancel_token UUID;
  v_checkin_token UUID;
  v_slot_capacity INT;
  v_slot_registered INT;
BEGIN
  -- Security Check
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 1. Get Waitlist Entry
  SELECT * INTO v_entry FROM waitlist WHERE id = p_waitlist_id;
  
  IF v_entry IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Waitlist entry not found');
  END IF;

  -- 2. Check Slot Capacity (Optional: admins can override, but let's be safe for now)
  -- Or strictly enforcing admin power: we allow overbooking if admin clicks promote?
  -- Let's stick to standard capacity check for safety, user can increase capacity if needed.
  SELECT capacity, registered_count INTO v_slot_capacity, v_slot_registered
  FROM shift_slots WHERE id = v_entry.slot_id;
  
  IF v_slot_registered >= v_slot_capacity THEN
     RETURN json_build_object('success', false, 'error', 'Slot is full. Increase capacity first.');
  END IF;

  -- 3. Create Registration
  INSERT INTO registrations (full_name, phone, email, event_id)
  VALUES (v_entry.full_name, v_entry.phone, v_entry.email, v_entry.event_id)
  RETURNING id, cancel_token INTO v_registration_id, v_cancel_token;

  -- 4. Create Registration Slot
  INSERT INTO registration_slots (registration_id, slot_id)
  VALUES (v_registration_id, v_entry.slot_id)
  RETURNING checkin_token INTO v_checkin_token;

  -- 5. Update Slot Count
  UPDATE shift_slots 
  SET registered_count = registered_count + 1
  WHERE id = v_entry.slot_id;

  -- 6. Remove from Waitlist
  DELETE FROM waitlist WHERE id = p_waitlist_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Promoted successfully',
    'registration_id', v_registration_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- 2. Remove from Waitlist
CREATE OR REPLACE FUNCTION admin_remove_waitlist_entry(
  p_password TEXT,
  p_waitlist_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Security Check
  IF p_password != 'temple2026' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM waitlist WHERE id = p_waitlist_id;
  
  IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Entry not found');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Removed from waitlist');
END;
$$;

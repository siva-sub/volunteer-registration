-- =====================================================
-- SECURE ADMIN FUNCTIONS
-- Replaces direct table access to avoid exposing service keys
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. GET ALL REGISTRATIONS (Secured by password)
CREATE OR REPLACE FUNCTION admin_get_registrations(p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple password check
  IF p_password != 'temple2026' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN json_build_object(
    'success', true,
    'data', (
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
                'id', rs.id,
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
    )
  );
END;
$$;

-- 2. DELETE REGISTRATION (Secured by password)
CREATE OR REPLACE FUNCTION admin_delete_registration(p_password TEXT, p_registration_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id UUID;
BEGIN
  IF p_password != 'temple2026' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Decrement counts for all slots this person was in
  FOR v_slot_id IN 
    SELECT slot_id FROM registration_slots WHERE registration_id = p_registration_id
  LOOP
    UPDATE shift_slots 
    SET registered_count = registered_count - 1
    WHERE id = v_slot_id;
  END LOOP;

  -- Delete the registration (cascades to registration_slots)
  DELETE FROM registrations WHERE id = p_registration_id;

  RETURN json_build_object('success', true, 'message', 'Registration deleted');
END;
$$;

-- 3. UPDATE REGISTRATION (Secured by password)
CREATE OR REPLACE FUNCTION admin_update_registration(
  p_password TEXT, 
  p_registration_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_password != 'temple2026' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE registrations 
  SET 
    full_name = p_full_name,
    phone = p_phone,
    email = p_email
  WHERE id = p_registration_id;

  RETURN json_build_object('success', true, 'message', 'Registration updated');
END;
$$;

-- Grant access to anon (the function handles security via password)
GRANT EXECUTE ON FUNCTION admin_get_registrations(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_registration(TEXT, UUID) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_registration(TEXT, UUID, TEXT, TEXT, TEXT) TO anon;

-- 1. Fix Cancel Search RPC
CREATE OR REPLACE FUNCTION get_registrations_by_phone(p_phone TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_regs JSON;
BEGIN
  -- Strip spaces/dashes if needed, or assume frontend does it
  -- Simple exact match for now
  SELECT json_agg(r_data) INTO v_regs
  FROM (
    SELECT 
      r.full_name, 
      r.cancel_token,
      r.created_at,
      e.title as event_title,
      (
        SELECT json_agg(rs.id) 
        FROM registration_slots rs 
        WHERE rs.registration_id = r.id
      ) as slots
    FROM registrations r
    JOIN registration_slots rs_join ON rs_join.registration_id = r.id
    JOIN shift_slots ss ON ss.id = rs_join.slot_id
    JOIN events e ON e.id = ss.event_id
    WHERE r.phone = p_phone
    GROUP BY r.id, r.full_name, r.cancel_token, r.created_at, e.title
  ) r_data;

  RETURN COALESCE(v_regs, '[]'::json);
END; $$;

GRANT EXECUTE ON FUNCTION get_registrations_by_phone(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_registrations_by_phone(TEXT) TO service_role;

-- 2. Ensure admin_get_registrations is secure and correct
CREATE OR REPLACE FUNCTION admin_get_registrations(p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_password != 'temple2026' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  RETURN json_build_object(
    'success', true,
    'data', (
      SELECT json_agg(t) FROM (
        SELECT 
          r.id, r.full_name, r.phone, r.email, r.created_at,
          (
            SELECT json_agg(json_build_object(
              'id', rs.id,
              'slot_id', ss.id,
              'shift_name', ss.shift_name,
              'date', ss.date,
              'start_time', ss.start_time,
              'end_time', ss.end_time,
              'event_id', ss.event_id  -- Added event_id for filtering
            ))
            FROM registration_slots rs
            JOIN shift_slots ss ON rs.slot_id = ss.id
            WHERE rs.registration_id = r.id
          ) as shifts
        FROM registrations r
        ORDER BY r.created_at DESC
      ) t
    )
  );
END; $$;

GRANT EXECUTE ON FUNCTION admin_get_registrations(TEXT) TO anon;

-- =====================================================
-- MIGRATION: ADMIN CREATE SLOTS RPC
-- Reason: Direct insert into shift_slots fails RLS.
-- =====================================================

CREATE OR REPLACE FUNCTION admin_create_slots(
  p_password TEXT,
  p_slots JSONB
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

  -- Bulk Insert
  INSERT INTO shift_slots (
    event_id, 
    date, 
    day_of_week, 
    shift_name, 
    start_time, 
    end_time, 
    capacity, 
    station, 
    registered_count, 
    sales_config
  )
  SELECT 
    (x->>'event_id')::UUID,
    (x->>'date')::DATE,
    (x->>'day_of_week'),
    (x->>'shift_name'),
    (x->>'start_time')::TIME,
    (x->>'end_time')::TIME,
    COALESCE((x->>'capacity')::INT, 10),
    (x->>'station'),
    0, -- Force 0
    (x->'sales_config')
  FROM jsonb_array_elements(p_slots) x;

  RETURN json_build_object('success', true, 'count', jsonb_array_length(p_slots));
END;
$$;

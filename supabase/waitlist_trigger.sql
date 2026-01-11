-- Waitlist Promotion Trigger
-- Automatically promotes the next person in line when a slot becomes available.

CREATE OR REPLACE FUNCTION handle_waitlist_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_waitlisted RECORD;
  v_event RECORD;
  v_slot RECORD;
  v_new_reg_id UUID;
  v_anon_key TEXT := 'sb_publishable_uXC8v4RM1HHCGEZKOnpbMg_seCrVNYo'; -- Hardcoded for now, ideally fetched from vault
BEGIN
  -- 1. Find the next person on the waitlist for this slot
  SELECT * INTO v_next_waitlisted
  FROM waitlist
  WHERE slot_id = OLD.slot_id 
    AND promoted_at IS NULL 
    AND expired_at IS NULL
  ORDER BY position ASC
  LIMIT 1;

  IF v_next_waitlisted IS NOT NULL THEN
    -- 2. Create a new registration (if they don't have one for this event yet, or link to existing)
    -- For simplicity, we'll create a new registration record for each promotion to ensure a unique cancel_token
    INSERT INTO registrations (full_name, phone, email, event_id)
    VALUES (v_next_waitlisted.full_name, v_next_waitlisted.phone, v_next_waitlisted.email, v_next_waitlisted.event_id)
    RETURNING id INTO v_new_reg_id;

    -- 3. Create the registration slot
    INSERT INTO registration_slots (registration_id, slot_id)
    VALUES (v_new_reg_id, v_next_waitlisted.slot_id);

    -- 4. Mark waitlist entry as promoted
    UPDATE waitlist SET promoted_at = NOW() WHERE id = v_next_waitlisted.id;

    -- 5. Get event and slot details for the email
    SELECT * INTO v_slot FROM shift_slots WHERE id = v_next_waitlisted.slot_id;
    SELECT * INTO v_event FROM events WHERE id = v_next_waitlisted.event_id;

    -- 6. Trigger the "Waitlist Promote" email via Edge Function
    IF v_next_waitlisted.email IS NOT NULL AND v_next_waitlisted.email != '' THEN
      PERFORM net.http_post(
        url := 'https://zpqnoxllhbyggyxvvpaa.supabase.co/functions/v1/send-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
          'type', 'waitlist_promote',
          'name', v_next_waitlisted.full_name,
          'email', v_next_waitlisted.email,
          'slots', jsonb_build_array(
            jsonb_build_object(
              'date', v_slot.date,
              'shift_name', v_slot.shift_name,
              'start_time', v_slot.start_time,
              'end_time', v_slot.end_time
            )
          ),
          'event_details', jsonb_build_object(
            'title', v_event.title,
            'organization_name', v_event.organization_name
          )
        )
      );
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_waitlist_promotion ON registration_slots;
CREATE TRIGGER trg_waitlist_promotion
AFTER DELETE ON registration_slots
FOR EACH ROW
EXECUTE FUNCTION handle_waitlist_promotion();

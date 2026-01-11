-- =====================================================
-- MIGRATION: ADD STATION COLUMN
-- Reason: Missing column causing slot generation failure.
-- =====================================================

ALTER TABLE shift_slots ADD COLUMN IF NOT EXISTS station TEXT DEFAULT NULL;

-- =====================================================
-- FIX: Additional RLS Policies for Anonymous Registration
-- Run this in Supabase SQL Editor after the main schema.sql
-- =====================================================

-- The register_volunteer function is SECURITY DEFINER and runs as the
-- function owner, but we need to ensure the anon role can call it.

-- Allow anon role to INSERT registrations (needed because SECURITY DEFINER
-- still respects RLS in some PostgreSQL versions)
CREATE POLICY "Public can create registrations" ON registrations
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anon role to INSERT registration_slots
CREATE POLICY "Public can create registration slots" ON registration_slots
  FOR INSERT TO anon WITH CHECK (true);

-- Allow anon role to UPDATE shift_slots (for incrementing registered_count)
CREATE POLICY "Public can update shift slots" ON shift_slots
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Grant usage on the schema if needed
GRANT USAGE ON SCHEMA public TO anon;

-- Ensure anon has proper permissions
GRANT SELECT, INSERT ON registrations TO anon;
GRANT SELECT, INSERT ON registration_slots TO anon;
GRANT SELECT, UPDATE ON shift_slots TO anon;

-- Alternative approach: Make function bypass RLS entirely
-- This is the cleanest solution for atomic registration
ALTER FUNCTION register_volunteer(TEXT, TEXT, TEXT, UUID[]) SET search_path = public;

-- Grant execute on the function (may already exist)
GRANT EXECUTE ON FUNCTION register_volunteer(TEXT, TEXT, TEXT, UUID[]) TO anon;

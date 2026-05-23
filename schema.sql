-- schema.sql
-- Run this script in the Supabase SQL Editor to set up the schema and RLS policies.

-- 1. Create Admins Table
CREATE TABLE public.admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Populate initial administrator email
INSERT INTO public.admins (email) 
VALUES ('admin@company.com')
ON CONFLICT (email) DO NOTHING;

-- 2. Create Employees Profile Table
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Create Attendance Table
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(10) CHECK (status IN ('Present', 'Absent', 'Half Day')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
);

-- 4. Create Deductions Table
CREATE TABLE public.deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reason TEXT NOT NULL,
    points_lost INTEGER CHECK (points_lost >= 0) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Create Performance Indexes
CREATE INDEX idx_attendance_date ON public.attendance(date);
CREATE INDEX idx_attendance_employee ON public.attendance(employee_id);
CREATE INDEX idx_deductions_employee_date ON public.deductions(employee_id, date);

-- =========================================================================
-- SECURITY & ROW-LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Helper Function to check if current authenticated session is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins 
    WHERE email = auth.jwt() ->> 'email'
  );
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------
-- Employees Table Policies
-- ---------------------------------

-- Admin access: Full rights
CREATE POLICY admin_all_employees ON public.employees 
    FOR ALL TO authenticated USING (public.is_admin());

-- Employee access: Can read their own profile details
CREATE POLICY employee_read_own ON public.employees 
    FOR SELECT TO authenticated USING (auth.uid() = id);

-- ---------------------------------
-- Attendance Table Policies
-- ---------------------------------

-- Admin access: Full rights
CREATE POLICY admin_all_attendance ON public.attendance 
    FOR ALL TO authenticated USING (public.is_admin());

-- Employee access: Can read their own attendance logs only
CREATE POLICY employee_read_own_attendance ON public.attendance 
    FOR SELECT TO authenticated USING (auth.uid() = employee_id);

-- ---------------------------------
-- Deductions Table Policies
-- ---------------------------------

-- Admin access: Full rights
CREATE POLICY admin_all_deductions ON public.deductions 
    FOR ALL TO authenticated USING (public.is_admin());

-- Employee access: Can read their own deduction entries only
CREATE POLICY employee_read_own_deductions ON public.deductions 
    FOR SELECT TO authenticated USING (auth.uid() = employee_id);

-- ---------------------------------
-- Admins Table Policies
-- ---------------------------------

-- Admin access: Full rights to read/edit admin lists
CREATE POLICY admin_all_admins ON public.admins 
    FOR ALL TO authenticated USING (public.is_admin());

-- Employee access: Can check if they themselves are admins
CREATE POLICY employee_read_admins ON public.admins 
    FOR SELECT TO authenticated USING (email = auth.jwt() ->> 'email');

-- =========================================================================
-- AUTOMATIC EMPLOYEE PROFILE SYNC TRIGGER
-- =========================================================================
-- Automatically creates an employee profile row in public.employees when 
-- a new user account is created in auth.users (e.g., via the Supabase Auth Dashboard).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.employees (id, name, email, department)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'department', 'Engineering')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute after a new auth user is inserted
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- BLOOD CONNECT - SUPABASE DATABASE SCHEMA
-- Paste this script in the SQL Editor on your Supabase dashboard.
-- ==========================================

-- 1. PROFILES TABLE (Linked to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'donor', -- 'donor' or 'admin'
    blood_group TEXT,
    location TEXT,
    age INTEGER,
    gender TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EMERGENCY REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name TEXT NOT NULL,
    blood_group TEXT NOT NULL,
    hospital_name TEXT NOT NULL,
    location TEXT NOT NULL,
    contact TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'Normal', -- 'Normal', 'High', 'Critical'
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'assigned', 'fulfilled'
    assigned_donor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DONATION HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.donation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    facility TEXT NOT NULL,
    donation_date TEXT NOT NULL,
    volume_ml INTEGER NOT NULL DEFAULT 350,
    status TEXT NOT NULL DEFAULT 'Completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VIEW FOR EMERGENCY REQUEST DETAILS (Joining Profiles for Donor Names)
CREATE OR REPLACE VIEW public.emergency_requests_view AS
SELECT 
    r.*,
    p.name AS assigned_donor_name
FROM 
    public.emergency_requests r
LEFT JOIN 
    public.profiles p ON r.assigned_donor_id = p.id;

-- 5. TRIGGER TO AUTOMATICALLY CREATE A PROFILE ROW ON AUTH SIGN UP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, 
        name, 
        email, 
        phone, 
        role, 
        blood_group, 
        location, 
        age, 
        gender, 
        is_available, 
        avatar_url
    ) VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', ''),
        new.email,
        new.raw_user_meta_data->>'phone',
        COALESCE(new.raw_user_meta_data->>'role', 'donor'),
        new.raw_user_meta_data->>'blood_group',
        new.raw_user_meta_data->>'location',
        (new.raw_user_meta_data->>'age')::integer,
        new.raw_user_meta_data->>'gender',
        COALESCE((new.raw_user_meta_data->>'is_available')::boolean, true),
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. SEED DATA (For test accounts setup)
-- Note: User auth credentials must be created via Supabase dashboard / auth triggers. 
-- Once users are registered, the trigger handles setting up their profiles.

-- 7. SECURITY & ROW LEVEL POLICIES (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_history ENABLE ROW LEVEL SECURITY;

-- Allow public read access to profiles (for search functionality)
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
-- Allow users to update their own profiles
CREATE POLICY "Allow users to update own profiles" ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Allow public read and write access to emergency requests
CREATE POLICY "Allow public read requests" ON public.emergency_requests FOR SELECT USING (true);
CREATE POLICY "Allow public insert requests" ON public.emergency_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update requests" ON public.emergency_requests FOR UPDATE USING (true);

-- Allow public read and write access to donation history
CREATE POLICY "Allow public read history" ON public.donation_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert history" ON public.donation_history FOR INSERT WITH CHECK (true);

-- GlobalSync AI: Comprehensive Supabase PostgreSQL Schema
-- Includes: Profiles, Subscriptions, Usage Tracking, Messages (E2EE), Calls, and R2 Assets.

-- 1. SUBSCRIPTION PLANS TABLE
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY, -- 'free', 'premium', 'pro', 'business'
    price_id TEXT, -- Paddle Product ID
    translation_limit_chars BIGINT NOT NULL,
    call_limit_mins INT NOT NULL,
    storage_limit_mb INT NOT NULL,
    video_quality TEXT DEFAULT '720p',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROFILES TABLE
CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    photo_url TEXT,
    primary_language TEXT DEFAULT 'en',
    secondary_language TEXT,
    plan_id TEXT DEFAULT 'free' REFERENCES subscriptions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. USER USAGE TRACKING TABLE (For Quota Enforcement)
CREATE TABLE user_usage (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
    translated_chars BIGINT DEFAULT 0,
    call_minutes_used INT DEFAULT 0,
    storage_used_mb FLOAT DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. MESSAGES TABLE (With Translation & detected language)
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES profiles(id),
    receiver_id UUID REFERENCES profiles(id), -- For 1-on-1 chats
    group_id UUID, -- For group chats (if added later)
    original_text TEXT NOT NULL,
    translated_text TEXT,
    detected_language TEXT,
    is_encrypted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CALL LOGS TABLE (100ms Integration)
CREATE TABLE calls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id TEXT NOT NULL,
    caller_id UUID REFERENCES profiles(id),
    receiver_id UUID REFERENCES profiles(id),
    call_type TEXT CHECK (call_type IN ('audio', 'video')),
    duration_seconds INT DEFAULT 0,
    is_translated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. MEDIA STORAGE METADATA (Cloudflare R2)
CREATE TABLE media_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size_mb FLOAT NOT NULL,
    r2_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own messages" ON messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own usage" ON user_usage FOR SELECT USING (auth.uid() = user_id);

-- 8. INITIAL SEED DATA FOR PLANS
INSERT INTO subscriptions (id, translation_limit_chars, call_limit_mins, storage_limit_mb)
VALUES 
('free', 2000000, 100, 500),
('premium', 5000000, 5000, 5120),
('pro', 999999999, 999999, 20480),
('business', 999999999, 999999, 51200);
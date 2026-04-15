-- =============================================================================
-- FLUX GAME - DATABASE ARCHITECTURE (PRODUCTION VERSION)
-- Purpose: Financial Integrity, XP Scaling, and Anti-Fraud Scans.
-- =============================================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TYPES & ENUMS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
        CREATE TYPE transaction_type AS ENUM (
            'deposit', 'withdraw', 'game_win', 'game_loss', 'scan_reward', 'bonus', 'purchase'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'game_status') THEN
        CREATE TYPE game_status AS ENUM ('active', 'maintenance', 'deprecated');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_url TEXT DEFAULT 'https://i.pravatar.cc/300?img=7',

    -- Financials (High Precision)
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),

    -- Gamification
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    total_wins INTEGER NOT NULL DEFAULT 0,
    total_games INTEGER NOT NULL DEFAULT 0,

    -- System
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_ranking ON users(coins DESC, xp DESC);

-- 3. GAMES LOBBIES
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    min_bet DECIMAL(15, 2) DEFAULT 0.00,
    max_reward DECIMAL(15, 2) DEFAULT 1000.00,
    status game_status DEFAULT 'active',
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. MATCHES HISTORY
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id),
    points INTEGER DEFAULT 0,
    win_amount DECIMAL(15, 2) DEFAULT 0.00,
    xp_gained INTEGER DEFAULT 0,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. SCAN RECORDS (ANTI-FRAUD)
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT UNIQUE NOT NULL,
    reward_amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TRANSACTIONS (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    type transaction_type NOT NULL,
    description TEXT,
    reference_id UUID, -- match_id or scan_id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. AUTO LEVEL-UP TRIGGER
CREATE OR REPLACE FUNCTION fn_calculate_level()
RETURNS TRIGGER AS $$
DECLARE
    new_level INTEGER;
BEGIN
    -- Formula: Level = floor(sqrt(xp / 100)) + 1
    new_level := floor(sqrt(NEW.xp / 100)) + 1;
    IF new_level > OLD.level THEN
        NEW.level := new_level;
    END IF;
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_level_up ON users;
CREATE TRIGGER trg_user_level_up
BEFORE UPDATE OF xp ON users
FOR EACH ROW EXECUTE FUNCTION fn_calculate_level();

-- 8. SEED DATA (GAMES FROM DESIGN)
INSERT INTO games (slug, title, category, min_bet, max_reward) VALUES
('poker-queen', 'Poker Queen', 'Casino', 15.00, 5000.00),
('memory-master', 'Memory Master', 'Casual', 0.00, 100.00),
('blackjack-pro', 'Blackjack Pro', 'Casino', 10.00, 2000.00),
('lucky-buy', '1R$ Lucky Buy', 'Luck', 1.00, 500.00)
ON CONFLICT (slug) DO NOTHING;
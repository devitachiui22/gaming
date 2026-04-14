-- =============================================================================
-- FLUX GAME - PROFESSIONAL DATABASE SCHEMA (POSTGRESQL / NEON)
-- Version: 1.0.0
-- Engineer: Senior Software Architect
-- =============================================================================

-- Habilitar extensões necessárias para UUID e criptografia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TIPOS CUSTOMIZADOS (ENUMS)
-- =============================================================================
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'deposit', 'withdraw', 'game_win', 'game_loss', 'scan_reward', 'bonus', 'purchase'
    );
    CREATE TYPE game_status AS ENUM ('active', 'maintenance', 'deprecated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. TABELA DE USUÁRIOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_url TEXT DEFAULT 'https://i.pravatar.cc/300?img=default',

    -- Financeiro (DECIMAL para precisão monetária, nunca use FLOAT para dinheiro)
    balance DECIMAL(15, 2) NOT NULL DEFAULT 100.00 CHECK (balance >= 0),
    coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),

    -- Gamificação
    level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
    total_wins INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,

    -- Auditoria e Segurança
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para login e ranking (Otimização de leitura)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_coins_ranking ON users(coins DESC);
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);

-- =============================================================================
-- 3. TABELA DE JOGOS
-- =============================================================================
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL, -- ex: 'memory-master'
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    min_bet DECIMAL(10, 2) DEFAULT 0.00,
    max_reward DECIMAL(10, 2) DEFAULT 1000.00,
    status game_status DEFAULT 'active',
    config JSONB DEFAULT '{}', -- Configurações específicas do jogo (dificuldade, etc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 4. TABELA DE PARTIDAS E SCORES
-- =============================================================================
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id),
    bet_amount DECIMAL(15, 2) DEFAULT 0.00,
    win_amount DECIMAL(15, 2) DEFAULT 0.00,
    points INTEGER DEFAULT 0,
    xp_gained INTEGER DEFAULT 0,
    metadata JSONB, -- Para salvar detalhes da partida (ex: cartas viradas)
    played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);

-- =============================================================================
-- 5. TABELA DE SCANS (RECOMPENSAS QR/BARCODE)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT UNIQUE NOT NULL, -- O hash do código lido para evitar duplicidade
    reward_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 6. TABELA DE TRANSAÇÕES (AUDITORIA FINANCEIRA COMPLETA)
-- =============================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    type transaction_type NOT NULL,
    description TEXT,
    reference_id UUID, -- ID da partida ou scan que gerou a transação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- =============================================================================
-- 7. LÓGICA DE TRIGGER: LEVEL UP AUTOMÁTICO
-- =============================================================================
-- Função que calcula o nível baseado no XP toda vez que o XP aumenta
CREATE OR REPLACE FUNCTION fn_calculate_user_level()
RETURNS TRIGGER AS $$
DECLARE
    new_level INTEGER;
BEGIN
    -- Lógica de Level: XP necessário = (Nível^2) * 100
    -- Ex: Level 1 -> 0 XP, Level 2 -> 400 XP, Level 3 -> 900 XP...
    new_level := floor(sqrt(NEW.xp / 100)) + 1;

    IF new_level > NEW.level THEN
        NEW.level := new_level;
    END IF;

    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_level_up
BEFORE UPDATE OF xp ON users
FOR EACH ROW
EXECUTE FUNCTION fn_calculate_user_level();

-- =============================================================================
-- 8. SEEDS (DADOS INICIAIS OBRIGATÓRIOS)
-- =============================================================================
INSERT INTO games (slug, title, category, min_bet, max_reward) VALUES
('memory-master', 'Memory Master', 'Casual', 5.00, 500.00),
('poker-flux', 'Flux Poker', 'Casino', 15.00, 5000.00),
('daily-wheel', 'Lucky Buy', 'Luck', 1.00, 100.00)
ON CONFLICT (slug) DO NOTHING;

-- Criar um bot para o Ranking inicial (opcional, mas bom para UX)
INSERT INTO users (name, email, password, balance, coins, level, xp) VALUES
('System Bot', 'bot@fluxgame.com', 'n/a', 0.00, 10000, 50, 250000)
ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- FIM DO SCRIPT
-- =============================================================================
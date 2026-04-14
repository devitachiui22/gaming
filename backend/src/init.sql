-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    balance DECIMAL(15,2) DEFAULT 0.00,
    coins INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Jogos Disponíveis
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- 'memory', 'quiz', etc
    min_bet DECIMAL(10,2) DEFAULT 0.00,
    status TEXT DEFAULT 'active'
);

-- Tabela de Pontuações e Partidas
CREATE TABLE scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID REFERENCES games(id),
    points INTEGER NOT NULL,
    win_amount DECIMAL(15,2) DEFAULT 0.00,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Scans (QR/Barcode) - Controle de unicidade
CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    code_hash TEXT UNIQUE NOT NULL, -- Código único
    reward DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Transações de Carteira
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(15,2) NOT NULL,
    type TEXT NOT NULL, -- 'deposit', 'withdraw', 'game_win', 'game_loss', 'scan_reward'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir alguns jogos iniciais
INSERT INTO games (title, type, min_bet) VALUES ('Memory Master', 'memory', 5.00);
INSERT INTO games (title, type, min_bet) VALUES ('Quiz Flux', 'quiz', 2.00);
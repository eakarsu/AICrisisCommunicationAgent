-- AI Crisis Communication Agent - Database Initialization
-- Run: psql -U postgres -d crisis_comm_db -f init.sql

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crisis_incidents (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
    status VARCHAR(20) CHECK (status IN ('active', 'monitoring', 'resolved', 'closed')) DEFAULT 'active',
    category VARCHAR(100),
    location VARCHAR(255),
    affected_stakeholders TEXT,
    lead_responder VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_monitoring (
    id SERIAL PRIMARY KEY,
    source VARCHAR(255),
    title VARCHAR(500),
    url TEXT,
    sentiment VARCHAR(50),
    reach INTEGER,
    platform VARCHAR(100),
    summary TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stakeholders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    role VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    priority VARCHAR(20) CHECK (priority IN ('primary', 'secondary', 'tertiary')) DEFAULT 'secondary',
    relationship VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS response_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    template_text TEXT NOT NULL,
    variables TEXT,
    use_case VARCHAR(255),
    tone VARCHAR(50),
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS press_releases (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    crisis_id INTEGER REFERENCES crisis_incidents(id) ON DELETE SET NULL,
    status VARCHAR(20) CHECK (status IN ('draft', 'review', 'approved', 'published')) DEFAULT 'draft',
    target_audience VARCHAR(255),
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_media_responses (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50),
    message TEXT,
    crisis_id INTEGER REFERENCES crisis_incidents(id) ON DELETE SET NULL,
    status VARCHAR(20) CHECK (status IN ('draft', 'scheduled', 'posted')) DEFAULT 'draft',
    tone VARCHAR(50),
    character_count INTEGER,
    ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sentiment_analyses (
    id SERIAL PRIMARY KEY,
    text_input TEXT,
    sentiment_score NUMERIC(4,3),
    sentiment_label VARCHAR(50),
    key_phrases TEXT,
    emotions TEXT,
    source VARCHAR(100),
    ai_analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS crisis_simulations (
    id SERIAL PRIMARY KEY,
    scenario_name VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
    objectives TEXT,
    participants TEXT,
    status VARCHAR(20) CHECK (status IN ('planned', 'in_progress', 'completed')) DEFAULT 'planned',
    results TEXT,
    lessons_learned TEXT,
    scheduled_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS communication_logs (
    id SERIAL PRIMARY KEY,
    crisis_id INTEGER REFERENCES crisis_incidents(id) ON DELETE SET NULL,
    channel VARCHAR(100),
    sender VARCHAR(255),
    recipient VARCHAR(255),
    message TEXT,
    direction VARCHAR(20) CHECK (direction IN ('inbound', 'outbound')) DEFAULT 'outbound',
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(100),
    department VARCHAR(100),
    phone VARCHAR(50),
    availability VARCHAR(20) CHECK (availability IN ('available', 'busy', 'offline')) DEFAULT 'available',
    skills TEXT,
    assigned_crisis_id INTEGER REFERENCES crisis_incidents(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incident_timelines (
    id SERIAL PRIMARY KEY,
    crisis_id INTEGER REFERENCES crisis_incidents(id) ON DELETE CASCADE,
    event_title VARCHAR(500),
    event_description TEXT,
    event_type VARCHAR(100),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reported_by VARCHAR(255),
    impact_level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_assessments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    likelihood INTEGER CHECK (likelihood >= 1 AND likelihood <= 5),
    impact INTEGER CHECK (impact >= 1 AND impact <= 5),
    risk_score INTEGER,
    mitigation_strategy TEXT,
    status VARCHAR(20) CHECK (status IN ('identified', 'analyzing', 'mitigated', 'accepted')) DEFAULT 'identified',
    ai_analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS talking_points (
    id SERIAL PRIMARY KEY,
    crisis_id INTEGER REFERENCES crisis_incidents(id) ON DELETE SET NULL,
    topic VARCHAR(500),
    points TEXT,
    target_audience VARCHAR(255),
    tone VARCHAR(50),
    spokesperson VARCHAR(255),
    ai_generated BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) CHECK (status IN ('draft', 'approved', 'used')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_crisis_analyses (
    id SERIAL PRIMARY KEY,
    crisis_id INTEGER REFERENCES crisis_incidents(id) ON DELETE SET NULL,
    title VARCHAR(500),
    summary TEXT,
    what_went_well TEXT,
    what_went_wrong TEXT,
    recommendations TEXT,
    metrics TEXT,
    ai_analysis TEXT,
    status VARCHAR(20) CHECK (status IN ('draft', 'final')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

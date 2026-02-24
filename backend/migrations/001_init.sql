CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS jurisdictions (
    id SERIAL PRIMARY KEY,
    county_fips VARCHAR(5) UNIQUE NOT NULL,
    county_name VARCHAR(100) NOT NULL,
    state_fips VARCHAR(2) NOT NULL DEFAULT '36',
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_geom ON jurisdictions USING GIST(geom);

CREATE TABLE IF NOT EXISTS tax_rates (
    id SERIAL PRIMARY KEY,
    county_fips VARCHAR(5) UNIQUE NOT NULL,
    county_name VARCHAR(100) NOT NULL,
    state_rate NUMERIC(6,5) NOT NULL DEFAULT 0.04000,
    county_rate NUMERIC(6,5) NOT NULL DEFAULT 0.00000,
    city_rate NUMERIC(6,5) NOT NULL DEFAULT 0.00000,
    special_rate NUMERIC(6,5) NOT NULL DEFAULT 0.00000,
    total_rate NUMERIC(6,5) NOT NULL,
    is_mctd BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    external_id INTEGER,
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(11,7) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    order_timestamp TIMESTAMPTZ NOT NULL,
    county_fips VARCHAR(5),
    county_name VARCHAR(100),
    state_rate NUMERIC(6,5),
    county_rate NUMERIC(6,5),
    city_rate NUMERIC(6,5),
    special_rate NUMERIC(6,5),
    composite_tax_rate NUMERIC(6,5),
    tax_amount NUMERIC(12,2),
    total_amount NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_county ON orders(county_fips);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp ON orders(order_timestamp);

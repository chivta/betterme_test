-- +goose Up
CREATE TABLE IF NOT EXISTS countries (
    id      SERIAL PRIMARY KEY,
    code    VARCHAR(20) UNIQUE NOT NULL, 
    name    VARCHAR(100) NOT NULL,
    geom    GEOMETRY(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_countries_geom ON countries USING GIST(geom);

-- +goose Down
DROP TABLE IF EXISTS countries;
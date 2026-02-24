package seed

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"taxcalc/internal/model"
)

const countyGeoJSONURL = "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json"

type GeoJSONCollection struct {
	Type     string           `json:"type"`
	Features []GeoJSONFeature `json:"features"`
}

type GeoJSONFeature struct {
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Geometry   json.RawMessage        `json:"geometry"`
	ID         string                 `json:"id"`
}

func Run(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("get underlying db: %w", err)
	}

	migrationSQL := getMigrationSQL()
	if _, err := sqlDB.Exec(migrationSQL); err != nil {
		return fmt.Errorf("run migration: %w", err)
	}
	log.Println("Migration applied successfully")

	if err := seedJurisdictions(db); err != nil {
		return fmt.Errorf("seed jurisdictions: %w", err)
	}

	if err := seedTaxRates(db); err != nil {
		return fmt.Errorf("seed tax rates: %w", err)
	}

	if err := seedAdminUser(db); err != nil {
		return fmt.Errorf("seed admin user: %w", err)
	}

	return nil
}

func getMigrationSQL() string {
	return `
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
`
}

func seedJurisdictions(db *gorm.DB) error {
	var count int64
	sqlDB, _ := db.DB()
	row := sqlDB.QueryRow("SELECT COUNT(*) FROM jurisdictions")
	if err := row.Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		log.Printf("Jurisdictions already seeded (%d records), skipping", count)
		return nil
	}

	log.Println("Downloading NY county boundaries from Census Bureau data...")
	resp, err := http.Get(countyGeoJSONURL)
	if err != nil {
		return fmt.Errorf("download geojson: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read geojson body: %w", err)
	}

	var collection GeoJSONCollection
	if err := json.Unmarshal(body, &collection); err != nil {
		return fmt.Errorf("parse geojson: %w", err)
	}

	nyCountyNames := getNYCountyNames()
	inserted := 0

	for _, feature := range collection.Features {
		fips := feature.ID
		if fips == "" {
			if v, ok := feature.Properties["GEO_ID"]; ok {
				fips = fmt.Sprintf("%v", v)
			}
		}

		if !strings.HasPrefix(fips, "36") {
			continue
		}

		name := ""
		if v, ok := feature.Properties["NAME"]; ok {
			name = fmt.Sprintf("%v", v)
		}
		if name == "" {
			if n, ok := nyCountyNames[fips]; ok {
				name = n
			} else {
				name = "Unknown"
			}
		}

		geomBytes, err := json.Marshal(feature.Geometry)
		if err != nil {
			log.Printf("Warning: failed to marshal geometry for %s: %v", fips, err)
			continue
		}

		query := `INSERT INTO jurisdictions (county_fips, county_name, state_fips, geom)
			VALUES ($1, $2, '36', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)))
			ON CONFLICT (county_fips) DO NOTHING`

		if err := sqlDB.QueryRow(query, fips, name, string(geomBytes)).Err(); err != nil {
			log.Printf("Warning: failed to insert jurisdiction %s (%s): %v", fips, name, err)
			continue
		}
		inserted++
	}

	log.Printf("Seeded %d NY county jurisdictions", inserted)
	return nil
}

func seedTaxRates(db *gorm.DB) error {
	var count int64
	db.Model(&model.TaxRate{}).Count(&count)
	if count > 0 {
		log.Printf("Tax rates already seeded (%d records), skipping", count)
		return nil
	}

	rates := getNYTaxRates()
	result := db.CreateInBatches(&rates, 20)
	if result.Error != nil {
		return fmt.Errorf("insert tax rates: %w", result.Error)
	}

	log.Printf("Seeded %d county tax rates", len(rates))
	return nil
}

func seedAdminUser(db *gorm.DB) error {
	var count int64
	db.Model(&model.User{}).Where("email = ?", "admin@test.com").Count(&count)
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := model.User{
		Email:        "admin@test.com",
		PasswordHash: string(hash),
		Name:         "Admin",
	}
	return db.Create(&user).Error
}

func getNYCountyNames() map[string]string {
	return map[string]string{
		"36001": "Albany", "36003": "Allegany", "36005": "Bronx",
		"36007": "Broome", "36009": "Cattaraugus", "36011": "Cayuga",
		"36013": "Chautauqua", "36015": "Chemung", "36017": "Chenango",
		"36019": "Clinton", "36021": "Columbia", "36023": "Cortland",
		"36025": "Delaware", "36027": "Dutchess", "36029": "Erie",
		"36031": "Essex", "36033": "Franklin", "36035": "Fulton",
		"36037": "Genesee", "36039": "Greene", "36041": "Hamilton",
		"36043": "Herkimer", "36045": "Jefferson", "36047": "Kings",
		"36049": "Lewis", "36051": "Livingston", "36053": "Madison",
		"36055": "Monroe", "36057": "Montgomery", "36059": "Nassau",
		"36061": "New York", "36063": "Niagara", "36065": "Oneida",
		"36067": "Onondaga", "36069": "Ontario", "36071": "Orange",
		"36073": "Orleans", "36075": "Oswego", "36077": "Otsego",
		"36079": "Putnam", "36081": "Queens", "36083": "Rensselaer",
		"36085": "Richmond", "36087": "Rockland", "36089": "St. Lawrence",
		"36091": "Saratoga", "36093": "Schenectady", "36095": "Schoharie",
		"36097": "Schuyler", "36099": "Seneca", "36101": "Steuben",
		"36103": "Suffolk", "36105": "Sullivan", "36107": "Tioga",
		"36109": "Tompkins", "36111": "Ulster", "36113": "Warren",
		"36115": "Washington", "36117": "Wayne", "36119": "Westchester",
		"36121": "Wyoming", "36123": "Yates",
	}
}

// Tax rates sourced from NY Publication 718 (effective March 2025) and salestaxhandbook.com.
// Breakdown: state_rate (always 4%) + county_rate + city_rate (NYC 4.5%) + special_rate (MCTD 0.375%).
func getNYTaxRates() []model.TaxRate {
	type r struct {
		fips    string
		name    string
		county  float64
		city    float64
		special float64
		mctd    bool
	}

	data := []r{
		{"36001", "Albany", 0.04, 0, 0, false},
		{"36003", "Allegany", 0.045, 0, 0, false},
		{"36005", "Bronx", 0, 0.045, 0.00375, true},
		{"36007", "Broome", 0.04, 0, 0, false},
		{"36009", "Cattaraugus", 0.04, 0, 0, false},
		{"36011", "Cayuga", 0.04, 0, 0, false},
		{"36013", "Chautauqua", 0.04, 0, 0, false},
		{"36015", "Chemung", 0.04, 0, 0, false},
		{"36017", "Chenango", 0.04, 0, 0, false},
		{"36019", "Clinton", 0.04, 0, 0, false},
		{"36021", "Columbia", 0.04, 0, 0, false},
		{"36023", "Cortland", 0.04, 0, 0, false},
		{"36025", "Delaware", 0.04, 0, 0, false},
		{"36027", "Dutchess", 0.0375, 0, 0.00375, true},
		{"36029", "Erie", 0.0475, 0, 0, false},
		{"36031", "Essex", 0.04, 0, 0, false},
		{"36033", "Franklin", 0.04, 0, 0, false},
		{"36035", "Fulton", 0.04, 0, 0, false},
		{"36037", "Genesee", 0.04, 0, 0, false},
		{"36039", "Greene", 0.04, 0, 0, false},
		{"36041", "Hamilton", 0.04, 0, 0, false},
		{"36043", "Herkimer", 0.04, 0, 0, false},
		{"36045", "Jefferson", 0.04, 0, 0, false},
		{"36047", "Kings", 0, 0.045, 0.00375, true},
		{"36049", "Lewis", 0.04, 0, 0, false},
		{"36051", "Livingston", 0.04, 0, 0, false},
		{"36053", "Madison", 0.04, 0, 0, false},
		{"36055", "Monroe", 0.04, 0, 0, false},
		{"36057", "Montgomery", 0.04, 0, 0, false},
		{"36059", "Nassau", 0.04250, 0, 0.00375, true},
		{"36061", "New York", 0, 0.045, 0.00375, true},
		{"36063", "Niagara", 0.04, 0, 0, false},
		{"36065", "Oneida", 0.04, 0, 0, false},
		{"36067", "Onondaga", 0.04, 0, 0, false},
		{"36069", "Ontario", 0.035, 0, 0, false},
		{"36071", "Orange", 0.03750, 0, 0.00375, true},
		{"36073", "Orleans", 0.04, 0, 0, false},
		{"36075", "Oswego", 0.04, 0, 0, false},
		{"36077", "Otsego", 0.04, 0, 0, false},
		{"36079", "Putnam", 0.04, 0, 0.00375, true},
		{"36081", "Queens", 0, 0.045, 0.00375, true},
		{"36083", "Rensselaer", 0.04, 0, 0, false},
		{"36085", "Richmond", 0, 0.045, 0.00375, true},
		{"36087", "Rockland", 0.04, 0, 0.00375, true},
		{"36089", "St. Lawrence", 0.04, 0, 0, false},
		{"36091", "Saratoga", 0.03, 0, 0, false},
		{"36093", "Schenectady", 0.04, 0, 0, false},
		{"36095", "Schoharie", 0.04, 0, 0, false},
		{"36097", "Schuyler", 0.04, 0, 0, false},
		{"36099", "Seneca", 0.04, 0, 0, false},
		{"36101", "Steuben", 0.04, 0, 0, false},
		{"36103", "Suffolk", 0.04375, 0, 0.00375, true},
		{"36105", "Sullivan", 0.04, 0, 0, false},
		{"36107", "Tioga", 0.04, 0, 0, false},
		{"36109", "Tompkins", 0.04, 0, 0, false},
		{"36111", "Ulster", 0.04, 0, 0, false},
		{"36113", "Warren", 0.03, 0, 0, false},
		{"36115", "Washington", 0.04, 0, 0, false},
		{"36117", "Wayne", 0.04, 0, 0, false},
		{"36119", "Westchester", 0.04, 0, 0.00375, true},
		{"36121", "Wyoming", 0.04, 0, 0, false},
		{"36123", "Yates", 0.04, 0, 0, false},
	}

	const stateRate = 0.04

	rates := make([]model.TaxRate, len(data))
	for i, d := range data {
		total := stateRate + d.county + d.city + d.special
		rates[i] = model.TaxRate{
			CountyFIPS:  d.fips,
			CountyName:  d.name,
			StateRate:   stateRate,
			CountyRate:  d.county,
			CityRate:    d.city,
			SpecialRate: d.special,
			TotalRate:   total,
			IsMCTD:      d.mctd,
		}
	}

	return rates
}

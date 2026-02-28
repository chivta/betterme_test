package repo

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"

	"taxcalc/internal/apperr"
	"taxcalc/internal/model"
)

// TaxRepo handles all tax-related data access.
// Coordinate lookups are served from Redis when cached; misses fall through to
// the PostGIS spatial query and the result is written back to the cache.
// County boundaries are static, so cached entries carry no expiry.
// BatchApplyTax is a bulk SQL UPDATE and bypasses the cache entirely.
type TaxRepo struct {
	db    *gorm.DB
	cache *redis.Client
}

func NewTaxRepo(db *gorm.DB, cache *redis.Client) *TaxRepo {
	return &TaxRepo{db: db, cache: cache}
}

// ResolveCountry determines which country a coordinate belongs to by checking
// the countries table with PostGIS spatial lookup.
// Returns the ISO country code (e.g. "US") for the matching country.
// To add a new country, insert its boundary into the countries table.
func (r *TaxRepo) ResolveCountry(lat, lon float64) (string, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return "", fmt.Errorf("get db: %w", err)
	}

	const query = `
		SELECT code FROM countries
		WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
		LIMIT 1
	`

	var code string
	err = sqlDB.QueryRow(query, lon, lat).Scan(&code)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("%w: received (%.6f, %.6f)", apperr.ErrOutOfBounds, lat, lon)
	}
	if err != nil {
		return "", fmt.Errorf("country resolution: %w", err)
	}

	return code, nil
}

// IsInNewYork reports whether (lat, lon) lies inside the NY state boundary
// stored in the ny_boundary table (the union of all click_that_hood county
// polygons, which covers coastal/water zones as well as land).
// A point inside this boundary but outside all county polygons is the
// duty-free coastal zone — not an error.
func (r *TaxRepo) IsInNewYork(lat, lon float64) (bool, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return false, fmt.Errorf("get db: %w", err)
	}

	const query = `
		SELECT EXISTS(
			SELECT 1 FROM ny_boundary
			WHERE ST_Contains(geom, ST_SetSRID(ST_Point($1, $2), 4326))
		)
	`

	var inNY bool
	if err := sqlDB.QueryRow(query, lon, lat).Scan(&inNY); err != nil {
		return false, fmt.Errorf("ny state lookup: %w", err)
	}
	return inNY, nil
}

func (r *TaxRepo) LookupByCoordinates(lat, lon float64) (*model.TaxBreakdown, error) {
	ctx := context.Background()
	key := taxCacheKey(lat, lon)

	if cached, err := r.cache.Get(ctx, key).Bytes(); err == nil {
		var b model.TaxBreakdown
		if err := json.Unmarshal(cached, &b); err != nil {
			slog.Warn("corrupt tax cache entry, fetching from db", "key", key, "err", err)
		} else {
			return &b, nil
		}
	}

	b, err := r.lookupFromDB(lat, lon)
	if err != nil {
		return nil, err
	}

	if data, err := json.Marshal(b); err != nil {
		slog.Warn("failed to marshal tax breakdown for cache", "err", err)
	} else {
		r.cache.Set(ctx, key, data, 0)
	}

	return b, nil
}

func (r *TaxRepo) lookupFromDB(lat, lon float64) (*model.TaxBreakdown, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return nil, fmt.Errorf("get db: %w", err)
	}

	const query = `
		SELECT j.county_fips, j.county_name,
			t.state_rate, t.county_rate, t.city_rate, t.special_rate, t.total_rate, t.is_mctd
		FROM jurisdictions j
		JOIN tax_rates t ON t.county_fips = j.county_fips
		WHERE ST_Contains(j.geom, ST_SetSRID(ST_Point($1, $2), 4326))
		LIMIT 1
	`

	var b model.TaxBreakdown
	err = sqlDB.QueryRow(query, lon, lat).Scan(
		&b.CountyFIPS, &b.CountyName,
		&b.StateRate, &b.CountyRate,
		&b.CityRate, &b.SpecialRate,
		&b.CompositeTaxRate, &b.IsMCTD,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("%w: received (%.6f, %.6f)", apperr.ErrOutOfBounds, lat, lon)
	}
	if err != nil {
		return nil, fmt.Errorf("spatial lookup: %w", err)
	}

	return &b, nil
}

// BatchApplyTax runs a single SQL UPDATE joining every untaxed order against
// PostGIS jurisdiction boundaries. Bypasses the cache — this operates on the
// orders table directly, not on the lookup path.
func (r *TaxRepo) BatchApplyTax() (int64, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return 0, err
	}

	const query = `
		UPDATE orders o
		SET
			county_fips        = t.county_fips,
			county_name        = t.county_name,
			state_rate         = t.state_rate,
			county_rate        = t.county_rate,
			city_rate          = t.city_rate,
			special_rate       = t.special_rate,
			composite_tax_rate = t.total_rate,
			tax_amount         = ROUND(o.subtotal * t.total_rate, 2),
			total_amount       = ROUND(o.subtotal + o.subtotal * t.total_rate, 2)
		FROM jurisdictions j
		JOIN tax_rates t ON t.county_fips = j.county_fips
		WHERE (o.composite_tax_rate IS NULL OR o.composite_tax_rate = 0)
			AND ST_Contains(j.geom, ST_SetSRID(ST_Point(o.longitude, o.latitude), 4326))
	`

	result, err := sqlDB.Exec(query)
	if err != nil {
		return 0, fmt.Errorf("batch tax update: %w", err)
	}

	affected, _ := result.RowsAffected()
	slog.Info("batch tax applied", "affected_orders", affected)
	return affected, nil
}

func taxCacheKey(lat, lon float64) string {
	return fmt.Sprintf("tax:coord:%.4f:%.4f", round4(lat), round4(lon))
}

func round4(v float64) float64 {
	return math.Round(v*10000) / 10000
}

package repo

import (
	"fmt"
	"log/slog"

	"gorm.io/gorm"
)

// GeoRepo handles spatial / GeoJSON data access.
type GeoRepo struct {
	db *gorm.DB
}

func NewGeoRepo(db *gorm.DB) *GeoRepo {
	return &GeoRepo{db: db}
}

// NYBoundaryGeoJSON returns the full NY state boundary (including Great Lakes
// and coastal water areas) from the ny_boundary table as a GeoJSON Feature.
func (r *GeoRepo) NYBoundaryGeoJSON() ([]byte, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return nil, fmt.Errorf("get db: %w", err)
	}

	const query = `
		SELECT json_build_object(
			'type', 'FeatureCollection',
			'features', json_build_array(
				json_build_object(
					'type',       'Feature',
					'geometry',   ST_AsGeoJSON(geom, 5)::json,
					'properties', '{}'::json
				)
			)
		)
		FROM ny_boundary
		LIMIT 1
	`

	var result []byte
	if err := sqlDB.QueryRow(query).Scan(&result); err != nil {
		slog.Error("failed to query ny boundary geojson", "err", err)
		return nil, fmt.Errorf("ny boundary geojson: %w", err)
	}
	slog.Debug("ny boundary geojson fetched", "bytes", len(result))
	return result, nil
}

// JurisdictionsGeoJSON returns all NY county boundaries as a GeoJSON
// FeatureCollection. Coordinate precision is capped at 5 decimal places
// (~1 m) to keep the response size reasonable.
func (r *GeoRepo) JurisdictionsGeoJSON() ([]byte, error) {
	sqlDB, err := r.db.DB()
	if err != nil {
		return nil, fmt.Errorf("get db: %w", err)
	}

	const query = `
		SELECT json_build_object(
			'type', 'FeatureCollection',
			'features', COALESCE(json_agg(
				json_build_object(
					'type',       'Feature',
					'geometry',   ST_AsGeoJSON(geom, 5)::json,
					'properties', json_build_object(
						'county_name', county_name,
						'county_fips', county_fips
					)
				)
			), '[]'::json)
		)
		FROM jurisdictions
	`

	var result []byte
	if err := sqlDB.QueryRow(query).Scan(&result); err != nil {
		slog.Error("failed to query jurisdictions geojson", "err", err)
		return nil, fmt.Errorf("jurisdictions geojson: %w", err)
	}
	slog.Debug("jurisdictions geojson fetched", "bytes", len(result))
	return result, nil
}

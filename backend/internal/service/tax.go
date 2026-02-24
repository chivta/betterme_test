package service

import (
	"database/sql"
	"fmt"
	"log"
	"math"

	"gorm.io/gorm"

	"taxcalc/internal/model"
)

type TaxService struct {
	db *gorm.DB
}

func NewTaxService(db *gorm.DB) *TaxService {
	return &TaxService{db: db}
}

func (s *TaxService) CalculateForCoordinates(lat, lon float64) (*model.TaxBreakdown, error) {
	sqlDB, err := s.db.DB()
	if err != nil {
		return nil, fmt.Errorf("get db connection: %w", err)
	}

	query := `
		SELECT j.county_fips, j.county_name,
			t.state_rate, t.county_rate, t.city_rate, t.special_rate, t.total_rate, t.is_mctd
		FROM jurisdictions j
		JOIN tax_rates t ON t.county_fips = j.county_fips
		WHERE ST_Contains(j.geom, ST_SetSRID(ST_Point($1, $2), 4326))
		LIMIT 1
	`

	var breakdown model.TaxBreakdown
	err = sqlDB.QueryRow(query, lon, lat).Scan(
		&breakdown.CountyFIPS, &breakdown.CountyName,
		&breakdown.StateRate, &breakdown.CountyRate,
		&breakdown.CityRate, &breakdown.SpecialRate,
		&breakdown.CompositeTaxRate, &breakdown.IsMCTD,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("coordinates (%.6f, %.6f) do not fall within any NY county", lat, lon)
	}
	if err != nil {
		return nil, fmt.Errorf("spatial lookup: %w", err)
	}

	return &breakdown, nil
}

// ApplyTaxToOrder fills in tax fields on an order based on spatial lookup.
func (s *TaxService) ApplyTaxToOrder(order *model.Order) error {
	breakdown, err := s.CalculateForCoordinates(order.Latitude, order.Longitude)
	if err != nil {
		return err
	}

	order.CountyFIPS = breakdown.CountyFIPS
	order.CountyName = breakdown.CountyName
	order.StateRate = breakdown.StateRate
	order.CountyRate = breakdown.CountyRate
	order.CityRate = breakdown.CityRate
	order.SpecialRate = breakdown.SpecialRate
	order.CompositeTaxRate = breakdown.CompositeTaxRate
	order.TaxAmount = roundTo2(order.Subtotal * breakdown.CompositeTaxRate)
	order.TotalAmount = roundTo2(order.Subtotal + order.TaxAmount)

	return nil
}

// BatchApplyTax runs a single SQL UPDATE to calculate tax for all orders missing tax info.
// Much faster than individual lookups for CSV imports.
func (s *TaxService) BatchApplyTax(db *gorm.DB) (int64, error) {
	sqlDB, err := db.DB()
	if err != nil {
		return 0, err
	}

	query := `
		UPDATE orders o
		SET
			county_fips = t.county_fips,
			county_name = t.county_name,
			state_rate = t.state_rate,
			county_rate = t.county_rate,
			city_rate = t.city_rate,
			special_rate = t.special_rate,
			composite_tax_rate = t.total_rate,
			tax_amount = ROUND(o.subtotal * t.total_rate, 2),
			total_amount = ROUND(o.subtotal + o.subtotal * t.total_rate, 2)
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
	log.Printf("Batch tax calculation applied to %d orders", affected)
	return affected, nil
}

func roundTo2(v float64) float64 {
	return math.Round(v*100) / 100
}

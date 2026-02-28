package service

import (
	"errors"
	"fmt"

	"taxcalc/internal/apperr"
	"taxcalc/internal/model"
)

// TaxRepo is defined here (consumer defines interface).
// Implementations live in internal/repo/postgres and internal/repo/redis.
type TaxRepo interface {
	// IsInNewYork reports whether the coordinate is inside the NY state boundary
	// (the union of all click_that_hood county polygons, including coastal zones).
	IsInNewYork(lat, lon float64) (bool, error)
	LookupByCoordinates(lat, lon float64) (*model.TaxBreakdown, error)
	BatchApplyTax() (int64, error)
}

// NewUSTaxCalculator returns a TaxCalculator that:
//  1. Rejects coordinates outside the NY state boundary (ErrOutOfBounds).
//  2. Returns tax = 0 for points inside NY but outside all county polygons
//     (the duty-free coastal / open-water zone).
//  3. Applies the full county/city/special tax breakdown for matched counties.
func NewUSTaxCalculator(repo TaxRepo) TaxCalculator {
	return func(order *model.Order) error {
		inNY, err := repo.IsInNewYork(order.Latitude, order.Longitude)
		if err != nil {
			return err
		}
		if !inNY {
			return fmt.Errorf("%w: received (%.6f, %.6f)", apperr.ErrOutOfBounds, order.Latitude, order.Longitude)
		}

		breakdown, err := repo.LookupByCoordinates(order.Latitude, order.Longitude)
		if err != nil {
			if errors.Is(err, apperr.ErrOutOfBounds) {
				// Inside NY state but outside every county polygon — duty-free zone.
				order.TaxAmount = 0
				order.TotalAmount = roundTo2(order.Subtotal)
				return nil
			}
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
}

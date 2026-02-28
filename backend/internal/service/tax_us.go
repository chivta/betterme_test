package service

import "taxcalc/internal/model"

// TaxRepo is defined here (consumer defines interface).
// Implementations live in internal/repo/postgres and internal/repo/redis.
type TaxRepo interface {
	LookupByCoordinates(lat, lon float64) (*model.TaxBreakdown, error)
	BatchApplyTax() (int64, error)
}

// NewUSTaxCalculator returns a TaxCalculator that uses PostGIS coordinate
// lookup to resolve NY-state county/city/special tax rates.
func NewUSTaxCalculator(repo TaxRepo) TaxCalculator {
	return func(order *model.Order) error {
		breakdown, err := repo.LookupByCoordinates(order.Latitude, order.Longitude)
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
}

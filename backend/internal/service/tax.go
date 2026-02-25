package service

import (
	"math"

	"taxcalc/internal/model"
)

// TaxRepo is defined here (consumer defines interface).
// Implementations live in internal/repo/postgres and internal/repo/redis.
type TaxRepo interface {
	LookupByCoordinates(lat, lon float64) (*model.TaxBreakdown, error)
	BatchApplyTax() (int64, error)
}

type TaxService struct {
	repo TaxRepo
}

func NewTaxService(repo TaxRepo) *TaxService {
	return &TaxService{repo: repo}
}

func (s *TaxService) ApplyTaxToOrder(order *model.Order) error {
	breakdown, err := s.repo.LookupByCoordinates(order.Latitude, order.Longitude)
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

func (s *TaxService) BatchApplyTax() (int64, error) {
	return s.repo.BatchApplyTax()
}

func roundTo2(v float64) float64 {
	return math.Round(v*100) / 100
}

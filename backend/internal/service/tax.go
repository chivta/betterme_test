package service

import (
	"fmt"
	"math"
	"strings"

	"taxcalc/internal/model"
)

// TaxCalculator computes tax for a single order.
// It receives the order (with subtotal, lat/lon already set) and must
// populate tax-related fields (rates, tax_amount, total_amount).
type TaxCalculator func(order *model.Order) error

// CountryResolver determines the country code from geographic coordinates.
// Returns an upper-case ISO country code (e.g. "US", "CA", "DE").
type CountryResolver func(lat, lon float64) (string, error)

// BatchTaxApplier runs a bulk tax calculation for all untaxed orders.
// Not every country needs one, so it is separated from TaxCalculator.
type BatchTaxApplier func() (int64, error)

// TaxService dispatches tax calculation to the correct country-specific
// strategy. The country is resolved automatically from the order's
// coordinates using the configured CountryResolver.
type TaxService struct {
	calculators  map[string]TaxCalculator
	resolver     CountryResolver
	batchApplier BatchTaxApplier
	fallback     TaxCalculator
}

// NewTaxService creates a TaxService with a coordinate-based country resolver
// and an optional fallback calculator for unregistered countries.
func NewTaxService(resolver CountryResolver, fallback TaxCalculator) *TaxService {
	return &TaxService{
		calculators: make(map[string]TaxCalculator),
		resolver:    resolver,
		fallback:    fallback,
	}
}

// Register adds a country-specific tax calculator.
// Country codes are normalised to upper-case (e.g. "us" → "US").
func (s *TaxService) Register(country string, calc TaxCalculator) {
	s.calculators[strings.ToUpper(country)] = calc
}

// SetBatchApplier sets the function used by BatchApplyTax.
func (s *TaxService) SetBatchApplier(fn BatchTaxApplier) {
	s.batchApplier = fn
}

// ApplyTaxToOrder resolves the country from the order's coordinates,
// then dispatches to the matching calculator (or the fallback).
func (s *TaxService) ApplyTaxToOrder(order *model.Order) error {
	country, err := s.resolver(order.Latitude, order.Longitude)
	if err != nil {
		return fmt.Errorf("resolve country: %w", err)
	}

	key := strings.ToUpper(country)
	if calc, ok := s.calculators[key]; ok {
		return calc(order)
	}
	if s.fallback != nil {
		return s.fallback(order)
	}
	return fmt.Errorf("no tax calculator registered for country %q", country)
}

// BatchApplyTax runs the bulk applier (if one has been set).
func (s *TaxService) BatchApplyTax() (int64, error) {
	if s.batchApplier == nil {
		return 0, fmt.Errorf("no batch tax applier configured")
	}
	return s.batchApplier()
}

func roundTo2(v float64) float64 {
	return math.Round(v*100) / 100
}

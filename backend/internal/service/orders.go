package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"log/slog"
	"strconv"
	"time"

	"taxcalc/internal/apperr"
	"taxcalc/internal/model"
)

// OrderRepo is defined here (consumer defines interface).
type OrderRepo interface {
	Create(order *model.Order) error
	CreateInBatches(orders []model.Order, batchSize int) error
	List(filter model.OrderFilter) (*model.OrdersResponse, error)
	SumTaxAmount() (float64, error)
	SumTaxAmountForIDs(ids []uint) (float64, error)
	DeleteAll() error
}

type OrderService struct {
	repo OrderRepo
	tax  *TaxService
}

func NewOrderService(repo OrderRepo, tax *TaxService) *OrderService {
	return &OrderService{repo: repo, tax: tax}
}

func (s *OrderService) CreateOrder(req model.CreateOrderRequest) (*model.Order, error) {
	ts := time.Now()
	if req.Timestamp != "" {
		parsed, err := time.Parse(time.RFC3339, req.Timestamp)
		if err != nil {
			parsed, err = time.Parse("2006-01-02 15:04:05", req.Timestamp)
			if err != nil {
				return nil, fmt.Errorf("%w: received %q", apperr.ErrInvalidTimestamp, req.Timestamp)
			}
		}
		ts = parsed
	}

	order := model.Order{
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		Subtotal:       req.Subtotal,
		OrderTimestamp:  ts,
	}

	if err := s.tax.ApplyTaxToOrder(&order); err != nil {
		return nil, fmt.Errorf("calculate tax: %w", err)
	}

	if err := s.repo.Create(&order); err != nil {
		return nil, fmt.Errorf("save order: %w", err)
	}

	return &order, nil
}

func (s *OrderService) PreviewTax(req model.CreateOrderRequest) (*model.TaxPreview, error) {
	order := model.Order{
		Latitude:  req.Latitude,
		Longitude: req.Longitude,
		Subtotal:  req.Subtotal,
	}

	if err := s.tax.ApplyTaxToOrder(&order); err != nil {
		return nil, fmt.Errorf("calculate tax: %w", err)
	}

	return &model.TaxPreview{
		Latitude:         order.Latitude,
		Longitude:        order.Longitude,
		Subtotal:         order.Subtotal,
		CountyFIPS:       order.CountyFIPS,
		CountyName:       order.CountyName,
		StateRate:        order.StateRate,
		CountyRate:       order.CountyRate,
		CityRate:         order.CityRate,
		SpecialRate:      order.SpecialRate,
		CompositeTaxRate: order.CompositeTaxRate,
		TaxAmount:        order.TaxAmount,
		TotalAmount:      order.TotalAmount,
	}, nil
}

func (s *OrderService) ImportCSV(reader io.Reader) (*model.ImportResult, error) {
	csvReader := csv.NewReader(reader)
	csvReader.LazyQuotes = true
	csvReader.TrimLeadingSpace = true

	header, err := csvReader.Read()
	if err != nil {
		return nil, fmt.Errorf("%w: could not read the header row — ensure the file is a valid CSV", apperr.ErrInvalidCSV)
	}

	colMap := make(map[string]int)
	for i, h := range header {
		colMap[h] = i
	}

	requiredCols := []string{"latitude", "longitude", "subtotal"}
	for _, col := range requiredCols {
		if _, ok := colMap[col]; !ok {
			return nil, fmt.Errorf("%w: missing required column %q — the CSV must have 'latitude', 'longitude', and 'subtotal' columns", apperr.ErrInvalidCSV, col)
		}
	}

	var orders []model.Order
	var errors []string
	lineNum := 1

	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		lineNum++
		if err != nil {
			errors = append(errors, fmt.Sprintf("line %d: %v", lineNum, err))
			continue
		}

		order, parseErr := parseCSVRow(record, colMap, lineNum)
		if parseErr != nil {
			errors = append(errors, parseErr.Error())
			continue
		}

		orders = append(orders, *order)
	}

	if len(orders) == 0 {
		return &model.ImportResult{
			TotalFailed: len(errors),
			Errors:      errors,
		}, nil
	}

	slog.Info("Parsed orders from CSV, inserting", "count", len(orders))

	batchSize := 500
	if err := s.repo.CreateInBatches(orders, batchSize); err != nil {
		return nil, fmt.Errorf("bulk insert: %w", err)
	}

	insertedIDs := make([]uint, 0, len(orders))
	for _, o := range orders {
		insertedIDs = append(insertedIDs, o.ID)
	}

	slog.Info("Running batch tax calculation")
	_, err = s.tax.BatchApplyTax()
	if err != nil {
		return nil, fmt.Errorf("batch tax calculation: %w", err)
	}

	totalTax, err := s.repo.SumTaxAmountForIDs(insertedIDs)
	if err != nil {
		return nil, fmt.Errorf("sum tax amount: %w", err)
	}

	truncatedErrors := errors
	if len(truncatedErrors) > 10 {
		truncatedErrors = truncatedErrors[:10]
		truncatedErrors = append(truncatedErrors, fmt.Sprintf("... and %d more errors", len(errors)-10))
	}

	return &model.ImportResult{
		TotalImported: len(orders),
		TotalFailed:   len(errors),
		TotalTax:      totalTax,
		Errors:        truncatedErrors,
	}, nil
}

func (s *OrderService) ListOrders(filter model.OrderFilter) (*model.OrdersResponse, error) {
	return s.repo.List(filter)
}

func (s *OrderService) DeleteAllOrders() error {
	return s.repo.DeleteAll()
}

func parseCSVRow(record []string, colMap map[string]int, lineNum int) (*model.Order, error) {
	getCol := func(name string) string {
		if idx, ok := colMap[name]; ok && idx < len(record) {
			return record[idx]
		}
		return ""
	}

	lat, err := strconv.ParseFloat(getCol("latitude"), 64)
	if err != nil {
		return nil, fmt.Errorf("line %d: 'latitude' must be a decimal number, got %q", lineNum, getCol("latitude"))
	}

	lon, err := strconv.ParseFloat(getCol("longitude"), 64)
	if err != nil {
		return nil, fmt.Errorf("line %d: 'longitude' must be a decimal number, got %q", lineNum, getCol("longitude"))
	}

	subtotal, err := strconv.ParseFloat(getCol("subtotal"), 64)
	if err != nil {
		return nil, fmt.Errorf("line %d: 'subtotal' must be a decimal number, got %q", lineNum, getCol("subtotal"))
	}

	ts := time.Now()
	if tsStr := getCol("timestamp"); tsStr != "" {
		parsed, err := time.Parse("2006-01-02 15:04:05.999999999", tsStr)
		if err != nil {
			parsed, err = time.Parse("2006-01-02 15:04:05", tsStr)
			if err != nil {
				parsed, err = time.Parse(time.RFC3339, tsStr)
				if err != nil {
					return nil, fmt.Errorf("line %d: 'timestamp' format not recognised — use 'YYYY-MM-DD HH:MM:SS' or RFC3339, got %q", lineNum, tsStr)
				}
			}
		}
		ts = parsed
	}

	var extID *int
	if idStr := getCol("id"); idStr != "" {
		id, err := strconv.Atoi(idStr)
		if err == nil {
			extID = &id
		}
	}

	return &model.Order{
		ExternalID:     extID,
		Latitude:       lat,
		Longitude:      lon,
		Subtotal:       subtotal,
		OrderTimestamp:  ts,
	}, nil
}

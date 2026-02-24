package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"strconv"
	"time"

	"taxcalc/internal/model"
	"taxcalc/internal/repository"
)

type OrderService struct {
	repo *repository.OrderRepository
	tax  *TaxService
}

func NewOrderService(repo *repository.OrderRepository, tax *TaxService) *OrderService {
	return &OrderService{repo: repo, tax: tax}
}

func (s *OrderService) CreateOrder(req model.CreateOrderRequest) (*model.Order, error) {
	ts := time.Now()
	if req.Timestamp != "" {
		parsed, err := time.Parse(time.RFC3339, req.Timestamp)
		if err != nil {
			parsed, err = time.Parse("2006-01-02 15:04:05", req.Timestamp)
			if err != nil {
				return nil, fmt.Errorf("invalid timestamp format: %w", err)
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

func (s *OrderService) ImportCSV(reader io.Reader) (*model.ImportResult, error) {
	csvReader := csv.NewReader(reader)
	csvReader.LazyQuotes = true
	csvReader.TrimLeadingSpace = true

	header, err := csvReader.Read()
	if err != nil {
		return nil, fmt.Errorf("read CSV header: %w", err)
	}

	colMap := make(map[string]int)
	for i, h := range header {
		colMap[h] = i
	}

	requiredCols := []string{"latitude", "longitude", "subtotal"}
	for _, col := range requiredCols {
		if _, ok := colMap[col]; !ok {
			return nil, fmt.Errorf("missing required column: %s", col)
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

	log.Printf("Parsed %d orders from CSV, inserting...", len(orders))

	batchSize := 500
	if err := s.repo.CreateInBatches(orders, batchSize); err != nil {
		return nil, fmt.Errorf("bulk insert: %w", err)
	}

	log.Println("Running batch tax calculation...")
	_, err = s.tax.BatchApplyTax(s.repo.GetDB())
	if err != nil {
		return nil, fmt.Errorf("batch tax calculation: %w", err)
	}

	var totalTax float64
	s.repo.GetDB().Model(&model.Order{}).
		Where("composite_tax_rate IS NOT NULL").
		Select("COALESCE(SUM(tax_amount), 0)").
		Row().Scan(&totalTax)

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

func (s *OrderService) ListOrders(filter repository.OrderFilter) (*model.OrdersResponse, error) {
	return s.repo.List(filter)
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
		return nil, fmt.Errorf("line %d: invalid latitude: %v", lineNum, err)
	}

	lon, err := strconv.ParseFloat(getCol("longitude"), 64)
	if err != nil {
		return nil, fmt.Errorf("line %d: invalid longitude: %v", lineNum, err)
	}

	subtotal, err := strconv.ParseFloat(getCol("subtotal"), 64)
	if err != nil {
		return nil, fmt.Errorf("line %d: invalid subtotal: %v", lineNum, err)
	}

	ts := time.Now()
	if tsStr := getCol("timestamp"); tsStr != "" {
		parsed, err := time.Parse("2006-01-02 15:04:05.999999999", tsStr)
		if err != nil {
			parsed, err = time.Parse("2006-01-02 15:04:05", tsStr)
			if err != nil {
				parsed, err = time.Parse(time.RFC3339, tsStr)
				if err != nil {
					return nil, fmt.Errorf("line %d: invalid timestamp: %v", lineNum, err)
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

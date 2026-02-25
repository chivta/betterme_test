package repository

import (
	"taxcalc/internal/model"

	"gorm.io/gorm"
)

type OrderRepository struct {
	db *gorm.DB
}

func NewOrderRepository(db *gorm.DB) *OrderRepository {
	return &OrderRepository{db: db}
}

func (r *OrderRepository) Create(order *model.Order) error {
	return r.db.Create(order).Error
}

func (r *OrderRepository) CreateInBatches(orders []model.Order, batchSize int) error {
	return r.db.CreateInBatches(&orders, batchSize).Error
}

type OrderFilter struct {
	Page     int
	PageSize int
	County   string
	DateFrom string
	DateTo   string
	MinTotal *float64
	MaxTotal *float64
}

func (r *OrderRepository) List(filter OrderFilter) (*model.OrdersResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 20
	}

	query := r.db.Model(&model.Order{})

	if filter.County != "" {
		query = query.Where("county_name ILIKE ?", "%"+filter.County+"%")
	}
	if filter.DateFrom != "" {
		query = query.Where("order_timestamp >= ?", filter.DateFrom)
	}
	if filter.DateTo != "" {
		query = query.Where("order_timestamp <= ?", filter.DateTo)
	}
	if filter.MinTotal != nil {
		query = query.Where("total_amount >= ?", *filter.MinTotal)
	}
	if filter.MaxTotal != nil {
		query = query.Where("total_amount <= ?", *filter.MaxTotal)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var orders []model.Order
	offset := (filter.Page - 1) * filter.PageSize
	if err := query.Order("id ASC").Offset(offset).Limit(filter.PageSize).Find(&orders).Error; err != nil {
		return nil, err
	}

	totalPages := int(total) / filter.PageSize
	if int(total)%filter.PageSize > 0 {
		totalPages++
	}

	return &model.OrdersResponse{
		Orders:     orders,
		Total:      total,
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		TotalPages: totalPages,
	}, nil
}

func (r *OrderRepository) SumTaxAmount() (float64, error) {
	var total float64
	result := r.db.Model(&model.Order{}).
		Where("composite_tax_rate IS NOT NULL").
		Select("COALESCE(SUM(tax_amount), 0)").
		Scan(&total)
	return total, result.Error
}

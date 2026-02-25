package repo

import (
	"gorm.io/gorm"

	"taxcalc/internal/model"
)

// OrderRepo handles all order data access against Postgres.
type OrderRepo struct {
	db *gorm.DB
}

func NewOrderRepo(db *gorm.DB) *OrderRepo {
	return &OrderRepo{db: db}
}

func (r *OrderRepo) Create(order *model.Order) error {
	return r.db.Create(order).Error
}

func (r *OrderRepo) CreateInBatches(orders []model.Order, batchSize int) error {
	return r.db.CreateInBatches(&orders, batchSize).Error
}

func (r *OrderRepo) List(filter model.OrderFilter) (*model.OrdersResponse, error) {
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

func (r *OrderRepo) SumTaxAmount() (float64, error) {
	var total float64
	result := r.db.Model(&model.Order{}).
		Where("composite_tax_rate IS NOT NULL").
		Select("COALESCE(SUM(tax_amount), 0)").
		Scan(&total)
	return total, result.Error
}

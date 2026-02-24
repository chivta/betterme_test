package model

import "time"

type Order struct {
	ID               uint      `gorm:"primarykey" json:"id"`
	ExternalID       *int      `json:"external_id,omitempty"`
	Latitude         float64   `gorm:"type:numeric(10,7);not null" json:"latitude"`
	Longitude        float64   `gorm:"type:numeric(11,7);not null" json:"longitude"`
	Subtotal         float64   `gorm:"type:numeric(12,2);not null" json:"subtotal"`
	OrderTimestamp   time.Time `gorm:"not null" json:"timestamp"`
	CountyFIPS       string    `gorm:"column:county_fips;size:5" json:"county_fips,omitempty"`
	CountyName       string    `gorm:"size:100" json:"county_name,omitempty"`
	StateRate        float64   `gorm:"type:numeric(6,5)" json:"state_rate"`
	CountyRate       float64   `gorm:"type:numeric(6,5)" json:"county_rate"`
	CityRate         float64   `gorm:"type:numeric(6,5)" json:"city_rate"`
	SpecialRate      float64   `gorm:"type:numeric(6,5)" json:"special_rate"`
	CompositeTaxRate float64   `gorm:"type:numeric(6,5)" json:"composite_tax_rate"`
	TaxAmount        float64   `gorm:"type:numeric(12,2)" json:"tax_amount"`
	TotalAmount      float64   `gorm:"type:numeric(12,2)" json:"total_amount"`
	CreatedAt        time.Time `json:"created_at"`
}

type OrdersResponse struct {
	Orders     []Order `json:"orders"`
	Total      int64   `json:"total"`
	Page       int     `json:"page"`
	PageSize   int     `json:"page_size"`
	TotalPages int     `json:"total_pages"`
}

type CreateOrderRequest struct {
	Latitude  float64 `json:"latitude" validate:"required"`
	Longitude float64 `json:"longitude" validate:"required"`
	Subtotal  float64 `json:"subtotal" validate:"required,gt=0"`
	Timestamp string  `json:"timestamp"`
}

type ImportResult struct {
	TotalImported int     `json:"total_imported"`
	TotalFailed   int     `json:"total_failed"`
	TotalTax      float64 `json:"total_tax"`
	Errors        []string `json:"errors,omitempty"`
}

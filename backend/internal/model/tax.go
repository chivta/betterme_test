package model

type TaxRate struct {
	ID          uint    `gorm:"primarykey" json:"id"`
	CountyFIPS  string  `gorm:"column:county_fips;uniqueIndex;size:5;not null" json:"county_fips"`
	CountyName  string  `gorm:"size:100;not null" json:"county_name"`
	StateRate   float64 `gorm:"type:numeric(6,5);not null;default:0.04" json:"state_rate"`
	CountyRate  float64 `gorm:"type:numeric(6,5);not null;default:0" json:"county_rate"`
	CityRate    float64 `gorm:"type:numeric(6,5);not null;default:0" json:"city_rate"`
	SpecialRate float64 `gorm:"type:numeric(6,5);not null;default:0" json:"special_rate"`
	TotalRate   float64 `gorm:"type:numeric(6,5);not null" json:"total_rate"`
	IsMCTD      bool    `gorm:"not null;default:false" json:"is_mctd"`
}

type TaxBreakdown struct {
	CountyFIPS       string  `json:"county_fips"`
	CountyName       string  `json:"county_name"`
	StateRate        float64 `json:"state_rate"`
	CountyRate       float64 `json:"county_rate"`
	CityRate         float64 `json:"city_rate"`
	SpecialRate      float64 `json:"special_rate"`
	CompositeTaxRate float64 `json:"composite_tax_rate"`
	IsMCTD           bool    `json:"is_mctd"`
}

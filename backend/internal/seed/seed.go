package seed

import (
	"fmt"
	"log"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"taxcalc/internal/model"
)

func Run(db *gorm.DB) error {
	if err := seedAdminUser(db); err != nil {
		return fmt.Errorf("seed admin user: %w", err)
	}

	return nil
}

func seedAdminUser(db *gorm.DB) error {
	var count int64
	db.Model(&model.User{}).Where("email = ?", "admin@test.com").Count(&count)
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := model.User{
		Email:        "admin@test.com",
		PasswordHash: string(hash),
		Name:         "Admin",
	}

	if err := db.Create(&user).Error; err != nil {
		return err
	}

	log.Println("Seeded admin user (admin@test.com)")
	return nil
}

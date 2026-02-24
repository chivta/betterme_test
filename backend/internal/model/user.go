package model

import "time"

type User struct {
	ID           uint      `gorm:"primarykey" json:"id"`
	Email        string    `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash string    `gorm:"size:255" json:"-"`
	Name         string    `gorm:"size:255" json:"name"`
	GoogleID     *string   `gorm:"uniqueIndex;size:255" json:"-"`
	AvatarURL    string    `gorm:"type:text" json:"avatar_url,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type RefreshToken struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
	TokenHash string    `gorm:"size:255;not null" json:"-"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

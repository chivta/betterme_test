package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"taxcalc/internal/model"
)

const (
	AccessTokenDuration  = 15 * time.Minute
	RefreshTokenDuration = 7 * 24 * time.Hour
)

type AuthService struct {
	db        *gorm.DB
	jwtSecret []byte
}

func NewAuthService(db *gorm.DB, jwtSecret string) *AuthService {
	return &AuthService{
		db:        db,
		jwtSecret: []byte(jwtSecret),
	}
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

type JWTClaims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func (s *AuthService) Login(email, password string) (*TokenPair, error) {
	var user model.User
	if err := s.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	if user.PasswordHash == "" {
		return nil, fmt.Errorf("this account uses Google sign-in only")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	return s.generateTokenPair(user)
}

func (s *AuthService) FindOrCreateGoogleUser(email, name, googleID, avatarURL string) (*TokenPair, error) {
	var user model.User
	result := s.db.Where("google_id = ?", googleID).First(&user)

	if result.Error == gorm.ErrRecordNotFound {
		existingResult := s.db.Where("email = ?", email).First(&user)
		if existingResult.Error == nil {
			user.GoogleID = &googleID
			user.AvatarURL = avatarURL
			if user.Name == "" {
				user.Name = name
			}
			s.db.Save(&user)
		} else {
			user = model.User{
				Email:     email,
				Name:      name,
				GoogleID:  &googleID,
				AvatarURL: avatarURL,
			}
			if err := s.db.Create(&user).Error; err != nil {
				return nil, fmt.Errorf("create user: %w", err)
			}
		}
	} else if result.Error != nil {
		return nil, fmt.Errorf("lookup user: %w", result.Error)
	}

	return s.generateTokenPair(user)
}

func (s *AuthService) RefreshTokens(refreshToken string) (*TokenPair, error) {
	hash := hashToken(refreshToken)

	var stored model.RefreshToken
	err := s.db.Where("token_hash = ? AND expires_at > ?", hash, time.Now()).First(&stored).Error
	if err != nil {
		return nil, fmt.Errorf("invalid or expired refresh token")
	}

	s.db.Delete(&stored)

	var user model.User
	if err := s.db.First(&user, stored.UserID).Error; err != nil {
		return nil, fmt.Errorf("user not found")
	}

	return s.generateTokenPair(user)
}

func (s *AuthService) Logout(refreshToken string) error {
	hash := hashToken(refreshToken)
	return s.db.Where("token_hash = ?", hash).Delete(&model.RefreshToken{}).Error
}

func (s *AuthService) ValidateAccessToken(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

func (s *AuthService) generateTokenPair(user model.User) (*TokenPair, error) {
	now := time.Now()

	claims := JWTClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(AccessTokenDuration)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   fmt.Sprintf("%d", user.ID),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	refreshToken, err := generateRandomToken()
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	rt := model.RefreshToken{
		UserID:    user.ID,
		TokenHash: hashToken(refreshToken),
		ExpiresAt: now.Add(RefreshTokenDuration),
	}
	if err := s.db.Create(&rt).Error; err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(AccessTokenDuration.Seconds()),
	}, nil
}

func generateRandomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

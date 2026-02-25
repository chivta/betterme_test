package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"taxcalc/internal/apperr"
	"taxcalc/internal/model"
	"taxcalc/internal/repo"
)

const (
	AccessTokenDuration  = 15 * time.Minute
	RefreshTokenDuration = 7 * 24 * time.Hour
)

// UserRepo is defined here (consumer defines interface).
type UserRepo interface {
	FindByEmail(email string) (*model.User, error)
	FindByGoogleID(googleID string) (*model.User, error)
	FindByID(id uint) (*model.User, error)
	Create(user *model.User) error
	Save(user *model.User) error
}

// TokenStore is defined here (consumer defines interface).
// The Redis implementation replaces the refresh_tokens Postgres table entirely.
type TokenStore interface {
	Store(hash string, userID uint, ttl time.Duration) error
	FindByHash(hash string) (uint, error)
	Delete(hash string) error
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

type AuthService struct {
	users     UserRepo
	tokens    TokenStore
	jwtSecret []byte
}

func NewAuthService(users UserRepo, tokens TokenStore, jwtSecret string) *AuthService {
	return &AuthService{
		users:     users,
		tokens:    tokens,
		jwtSecret: []byte(jwtSecret),
	}
}

func (s *AuthService) Login(email, password string) (*TokenPair, error) {
	user, err := s.users.FindByEmail(email)
	if err != nil {
		// Deliberately obscure whether the email exists.
		return nil, apperr.ErrInvalidCredentials
	}

	if user.PasswordHash == "" {
		return nil, apperr.ErrGoogleAuthOnly
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, apperr.ErrInvalidCredentials
	}

	return s.generateTokenPair(*user)
}

func (s *AuthService) FindOrCreateGoogleUser(email, name, googleID, avatarURL string) (*TokenPair, error) {
	user, err := s.users.FindByGoogleID(googleID)

	if errors.Is(err, repo.ErrNotFound) {
		existing, err := s.users.FindByEmail(email)
		if err != nil && !errors.Is(err, repo.ErrNotFound) {
			return nil, fmt.Errorf("lookup user by email: %w", err)
		}

		if existing != nil {
			existing.GoogleID = &googleID
			existing.AvatarURL = avatarURL
			if existing.Name == "" {
				existing.Name = name
			}
			if err := s.users.Save(existing); err != nil {
				return nil, fmt.Errorf("update user: %w", err)
			}
			user = existing
		} else {
			newUser := &model.User{
				Email:     email,
				Name:      name,
				GoogleID:  &googleID,
				AvatarURL: avatarURL,
			}
			if err := s.users.Create(newUser); err != nil {
				return nil, fmt.Errorf("create user: %w", err)
			}
			user = newUser
		}
	} else if err != nil {
		return nil, fmt.Errorf("lookup user: %w", err)
	}

	return s.generateTokenPair(*user)
}

func (s *AuthService) RefreshTokens(refreshToken string) (*TokenPair, error) {
	hash := hashToken(refreshToken)

	userID, err := s.tokens.FindByHash(hash)
	if err != nil {
		// ErrTokenInvalid is already a sentinel — pass it through directly.
		return nil, err
	}

	if err := s.tokens.Delete(hash); err != nil {
		return nil, fmt.Errorf("consume token: %w", err)
	}

	user, err := s.users.FindByID(userID)
	if err != nil {
		// Token pointed to a user that no longer exists — treat as server error.
		return nil, fmt.Errorf("user lookup after token validation: %w", err)
	}

	return s.generateTokenPair(*user)
}

func (s *AuthService) Logout(refreshToken string) error {
	return s.tokens.Delete(hashToken(refreshToken))
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

	if err := s.tokens.Store(hashToken(refreshToken), user.ID, RefreshTokenDuration); err != nil {
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

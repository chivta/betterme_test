package handler

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"

	"taxcalc/internal/config"
	"taxcalc/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
	oauthConfig *oauth2.Config
	frontendURL string
}

func NewAuthHandler(authService *service.AuthService, cfg *config.Config) *AuthHandler {
	var oauthCfg *oauth2.Config
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		oauthCfg = &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.GoogleRedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}

	return &AuthHandler{
		authService: authService,
		oauthConfig: oauthCfg,
		frontendURL: cfg.FrontendURL,
	}
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Login godoc
// @Summary      Login with credentials
// @Description  Authenticate with email and password to receive access and refresh tokens
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      LoginRequest  true  "Login credentials"
// @Success      200   {object}  service.TokenPair
// @Failure      400   {object}  map[string]string
// @Failure      401   {object}  map[string]string
// @Router       /api/auth/login [post]
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "request body must be valid JSON"})
	}

	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "both 'email' and 'password' fields are required"})
	}

	tokens, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		return respondError(c, err)
	}

	return c.JSON(tokens)
}

// Refresh godoc
// @Summary      Refresh tokens
// @Description  Exchange a valid refresh token for a new access + refresh token pair
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      RefreshRequest  true  "Refresh token"
// @Success      200   {object}  service.TokenPair
// @Failure      400   {object}  map[string]string
// @Failure      401   {object}  map[string]string
// @Router       /api/auth/refresh [post]
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "request body must be valid JSON"})
	}

	if req.RefreshToken == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "'refresh_token' field is required"})
	}

	tokens, err := h.authService.RefreshTokens(req.RefreshToken)
	if err != nil {
		return respondError(c, err)
	}

	return c.JSON(tokens)
}

// Logout godoc
// @Summary      Logout
// @Description  Invalidate a refresh token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        body  body      RefreshRequest  true  "Refresh token to invalidate"
// @Success      200   {object}  map[string]string
// @Router       /api/auth/logout [post]
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "request body must be valid JSON"})
	}

	// Logout is best-effort: always return success. Log failures but do not
	// surface them — the client cannot do anything useful with a logout error.
	if err := h.authService.Logout(req.RefreshToken); err != nil {
		log.Printf("logout error: %v", err)
	}

	return c.JSON(fiber.Map{"message": "logged out"})
}

// GoogleLogin godoc
// @Summary      Initiate Google OAuth login
// @Description  Redirects the user to Google's OAuth2 consent screen
// @Tags         auth
// @Produce      json
// @Success      302  "Redirect to Google"
// @Failure      501  {object}  map[string]string
// @Router       /api/auth/google [get]
func (h *AuthHandler) GoogleLogin(c *fiber.Ctx) error {
	if h.oauthConfig == nil {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "Google OAuth not configured"})
	}

	url := h.oauthConfig.AuthCodeURL("state", oauth2.AccessTypeOffline)
	return c.Redirect(url, fiber.StatusTemporaryRedirect)
}

// GoogleCallback godoc
// @Summary      Google OAuth callback
// @Description  Handles the OAuth2 callback from Google, creates/finds user, issues tokens
// @Tags         auth
// @Produce      json
// @Param        code   query  string  true  "Authorization code"
// @Param        state  query  string  false "State parameter"
// @Success      302  "Redirect to frontend with tokens"
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /api/auth/google/callback [get]
func (h *AuthHandler) GoogleCallback(c *fiber.Ctx) error {
	if h.oauthConfig == nil {
		return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{"error": "Google OAuth not configured"})
	}

	code := c.Query("code")
	if code == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "'code' query parameter is missing from the OAuth callback"})
	}

	token, err := h.oauthConfig.Exchange(context.Background(), code)
	if err != nil {
		return respondError(c, err)
	}

	userInfo, err := fetchGoogleUserInfo(token.AccessToken)
	if err != nil {
		return respondError(c, err)
	}

	tokens, err := h.authService.FindOrCreateGoogleUser(
		userInfo.Email, userInfo.Name, userInfo.ID, userInfo.Picture,
	)
	if err != nil {
		return respondError(c, err)
	}

	redirectURL := h.frontendURL + "/auth/callback" +
		"?access_token=" + tokens.AccessToken +
		"&refresh_token=" + tokens.RefreshToken

	return c.Redirect(redirectURL, fiber.StatusTemporaryRedirect)
}

type googleUserInfo struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func fetchGoogleUserInfo(accessToken string) (*googleUserInfo, error) {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var info googleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}

	return &info, nil
}

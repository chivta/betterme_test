package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"taxcalc/internal/service"
)

func JWTAuth(authService *service.AuthService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authorization header is missing — add 'Authorization: Bearer <token>' to your request",
			})
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authorization header format is invalid — expected 'Authorization: Bearer <token>'",
			})
		}

		claims, err := authService.ValidateAccessToken(parts[1])
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "access token is invalid or expired — use POST /api/auth/refresh to get a new one",
			})
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("user_email", claims.Email)

		return c.Next()
	}
}

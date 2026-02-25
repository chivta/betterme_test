package handler

import (
	"errors"
	"log"

	"github.com/gofiber/fiber/v2"

	"taxcalc/internal/apperr"
)

// respondError maps an error to the appropriate HTTP response.
//
// Known 4xx sentinel errors (from apperr) are sent to the client with their
// message — they describe a client mistake and contain no internal details.
//
// Everything else is treated as an internal server error: the real error is
// logged with method + path context, and a generic message is sent to the
// client to avoid leaking implementation details.
func respondError(c *fiber.Ctx, err error) error {
	switch {
	// 401
	case errors.Is(err, apperr.ErrInvalidCredentials),
		errors.Is(err, apperr.ErrGoogleAuthOnly),
		errors.Is(err, apperr.ErrTokenInvalid):
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})

	// 400
	case errors.Is(err, apperr.ErrInvalidTimestamp),
		errors.Is(err, apperr.ErrInvalidCSV),
		errors.Is(err, apperr.ErrOutOfBounds):
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})

	// 5xx — log the real error, sanitize the response
	default:
		log.Printf("internal error [%s %s]: %v", c.Method(), c.Path(), err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal server error"})
	}
}

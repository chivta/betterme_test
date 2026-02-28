package handler

import (
	"github.com/gofiber/fiber/v2"

	"taxcalc/internal/repo"
)

type GeoHandler struct {
	geoRepo *repo.GeoRepo
}

func NewGeoHandler(geoRepo *repo.GeoRepo) *GeoHandler {
	return &GeoHandler{geoRepo: geoRepo}
}

// NYBoundaryGeoJSON godoc
// @Summary      Full NY state boundary (including water)
// @Description  Returns the NY state boundary from the ny_boundary table as a GeoJSON FeatureCollection. Unlike the county jurisdictions, this polygon includes the Great Lakes and coastal water zones.
// @Tags         geo
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/geo/boundary [get]
func (h *GeoHandler) NYBoundaryGeoJSON(c *fiber.Ctx) error {
	data, err := h.geoRepo.NYBoundaryGeoJSON()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch NY state boundary",
		})
	}
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	c.Set("Cache-Control", "public, max-age=86400")
	return c.Send(data)
}

// JurisdictionsGeoJSON godoc
// @Summary      NY county jurisdiction boundaries
// @Description  Returns all NY county tax jurisdiction boundaries as a GeoJSON FeatureCollection. Each feature includes county_name and county_fips as properties. Response is safe to cache for 24 h.
// @Tags         geo
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      500  {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/geo/jurisdictions [get]
func (h *GeoHandler) JurisdictionsGeoJSON(c *fiber.Ctx) error {
	data, err := h.geoRepo.JurisdictionsGeoJSON()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to fetch jurisdiction boundaries",
		})
	}
	c.Set(fiber.HeaderContentType, fiber.MIMEApplicationJSON)
	c.Set("Cache-Control", "public, max-age=86400")
	return c.Send(data)
}

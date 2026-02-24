package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"taxcalc/internal/model"
	"taxcalc/internal/repository"
	"taxcalc/internal/service"
)

type OrderHandler struct {
	orderService *service.OrderService
}

func NewOrderHandler(orderService *service.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

// ImportCSV godoc
// @Summary      Import orders from CSV
// @Description  Upload a CSV file with order data. The system parses, calculates taxes, and saves all orders.
// @Tags         orders
// @Accept       multipart/form-data
// @Produce      json
// @Param        file  formData  file  true  "CSV file with orders"
// @Success      200   {object}  model.ImportResult
// @Failure      400   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/orders/import [post]
func (h *OrderHandler) ImportCSV(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "no file uploaded",
		})
	}

	f, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to open file",
		})
	}
	defer f.Close()

	result, err := h.orderService.ImportCSV(f)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(result)
}

// CreateOrder godoc
// @Summary      Create a single order
// @Description  Create an order manually with lat, lon, subtotal. Tax is calculated immediately.
// @Tags         orders
// @Accept       json
// @Produce      json
// @Param        order  body      model.CreateOrderRequest  true  "Order data"
// @Success      201    {object}  model.Order
// @Failure      400    {object}  map[string]string
// @Failure      500    {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/orders [post]
func (h *OrderHandler) CreateOrder(c *fiber.Ctx) error {
	var req model.CreateOrderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	if req.Subtotal <= 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "subtotal must be greater than 0",
		})
	}

	if req.Latitude < -90 || req.Latitude > 90 || req.Longitude < -180 || req.Longitude > 180 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid coordinates",
		})
	}

	order, err := h.orderService.CreateOrder(req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(order)
}

// ListOrders godoc
// @Summary      List orders with pagination and filters
// @Description  Returns paginated orders with calculated tax data. Supports filtering by county, date range, and total amount.
// @Tags         orders
// @Produce      json
// @Param        page       query     int     false  "Page number"       default(1)
// @Param        page_size  query     int     false  "Page size"         default(20)
// @Param        county     query     string  false  "Filter by county name"
// @Param        date_from  query     string  false  "Filter from date (YYYY-MM-DD)"
// @Param        date_to    query     string  false  "Filter to date (YYYY-MM-DD)"
// @Param        min_total  query     number  false  "Min total amount"
// @Param        max_total  query     number  false  "Max total amount"
// @Success      200  {object}  model.OrdersResponse
// @Failure      500  {object}  map[string]string
// @Security     BearerAuth
// @Router       /api/orders [get]
func (h *OrderHandler) ListOrders(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "20"))

	filter := repository.OrderFilter{
		Page:     page,
		PageSize: pageSize,
		County:   c.Query("county"),
		DateFrom: c.Query("date_from"),
		DateTo:   c.Query("date_to"),
	}

	if minStr := c.Query("min_total"); minStr != "" {
		v, err := strconv.ParseFloat(minStr, 64)
		if err == nil {
			filter.MinTotal = &v
		}
	}

	if maxStr := c.Query("max_total"); maxStr != "" {
		v, err := strconv.ParseFloat(maxStr, 64)
		if err == nil {
			filter.MaxTotal = &v
		}
	}

	result, err := h.orderService.ListOrders(filter)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(result)
}

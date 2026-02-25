package main

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/swagger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	_ "taxcalc/docs"
	"taxcalc/internal/config"
	"taxcalc/internal/handler"
	"taxcalc/internal/middleware"
	"taxcalc/internal/migrate"
	"taxcalc/internal/repository"
	"taxcalc/internal/seed"
	"taxcalc/internal/service"
)

// @title           Instant Wellness Tax Calculator API
// @version         1.0
// @description     API for calculating NY State composite sales tax on drone-delivered wellness kit orders.
// @host            localhost:8080
// @BasePath        /
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter your bearer token: Bearer <token>
func main() {
	cfg := config.Load()

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to get underlying sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	sqlDB.SetConnMaxIdleTime(1 * time.Minute)

	if err := migrate.Run(sqlDB); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	if err := seed.Run(db); err != nil {
		log.Fatalf("Failed to run seed: %v", err)
	}

	taxService := service.NewTaxService(db)
	orderRepo := repository.NewOrderRepository(db)
	orderService := service.NewOrderService(orderRepo, taxService)
	authService := service.NewAuthService(db, cfg.JWTSecret)

	orderHandler := handler.NewOrderHandler(orderService)
	authHandler := handler.NewAuthHandler(authService, cfg)

	app := fiber.New(fiber.Config{
		BodyLimit: 50 * 1024 * 1024, // 50MB for CSV uploads
	})

	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, DELETE, OPTIONS",
	}))

	app.Get("/swagger/*", swagger.HandlerDefault)

	api := app.Group("/api")

	auth := api.Group("/auth")
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authHandler.Logout)
	auth.Get("/google", authHandler.GoogleLogin)
	auth.Get("/google/callback", authHandler.GoogleCallback)

	orders := api.Group("/orders", middleware.JWTAuth(authService))
	orders.Post("/import", orderHandler.ImportCSV)
	orders.Post("/", orderHandler.CreateOrder)
	orders.Get("/", orderHandler.ListOrders)

	log.Printf("Server starting on :%s", cfg.Port)
	log.Printf("Swagger UI available at http://localhost:%s/swagger/index.html", cfg.Port)
	if err := app.Listen(":" + cfg.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

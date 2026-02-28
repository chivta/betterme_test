package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/swagger"
	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	_ "taxcalc/docs"
	"taxcalc/internal/config"
	"taxcalc/internal/handler"
	"taxcalc/internal/middleware"
	"taxcalc/internal/migrate"
	"taxcalc/internal/repo"
	"taxcalc/internal/seed"
	"taxcalc/internal/service"
)

// @title           Instant Wellness Tax Calculator API
// @version         1.0
// @description     API for calculating NY State composite sales tax on drone-delivered wellness kit orders.
// @host            int20h.chivtar.dev
// @BasePath        /
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Enter your bearer token: Bearer <token>
func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	cfg := config.Load()
	err := config.Validate(cfg)
	if err != nil {
		slog.Error("Config validation failed", "err", err)
		os.Exit(1)
	}

	// --- Postgres ---
	db, err := gorm.Open(postgres.Open(cfg.DB.DatabaseURL), &gorm.Config{})
	if err != nil {
		slog.Error("Failed to connect to database", "err", err)
		os.Exit(1)
	}

	sqlDB, err := db.DB()
	if err != nil {
		slog.Error("Failed to get underlying sql.DB", "err", err)
		os.Exit(1)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	sqlDB.SetConnMaxIdleTime(1 * time.Minute)

	if err := migrate.Run(sqlDB); err != nil {
		slog.Error("Failed to run migrations", "err", err)
		os.Exit(1)
	}

	if err := seed.Run(db); err != nil {
		slog.Error("Failed to run seed", "err", err)
		os.Exit(1)
	}

	// --- Redis ---
	redisOpts, err := redis.ParseURL(cfg.Cache.RedisURL)
	if err != nil {
		slog.Error("Failed to parse Redis URL", "err", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(redisOpts)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		slog.Error("Failed to connect to Redis", "err", err)
		os.Exit(1)
	}

	// --- Repos ---
	taxRepo   := repo.NewTaxRepo(db, rdb)
	orderRepo := repo.NewOrderRepo(db)
	userRepo  := repo.NewUserRepo(db)
	tokenRepo := repo.NewTokenRepo(rdb)

	// --- Services ---
	usCalc       := service.NewUSTaxCalculator(taxRepo)
	taxService   := service.NewTaxService(func(lat, lon float64) (string, error) {
		return "US", nil
	}, usCalc) // replace with taxRepo.ResolveCountry
	taxService.Register("US", usCalc)
	taxService.SetBatchApplier(taxRepo.BatchApplyTax)
	orderService := service.NewOrderService(orderRepo, taxService)
	authService  := service.NewAuthService(userRepo, tokenRepo, cfg.Auth.JWTSecret)

	// --- Handlers ---
	orderHandler := handler.NewOrderHandler(orderService)
	authHandler := handler.NewAuthHandler(authService, cfg)

	// --- HTTP ---
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
	orders.Post("/preview", orderHandler.PreviewTax)
	orders.Post("/", orderHandler.CreateOrder)
	orders.Get("/", orderHandler.ListOrders)

	slog.Info("Server starting", "port", cfg.Server.Port)
	slog.Info("Swagger UI available", "url", fmt.Sprintf("http://localhost:%s/swagger/index.html", cfg.Server.Port))
	if err := app.Listen(":" + cfg.Server.Port); err != nil {
		slog.Error("Failed to start server", "err", err)
		os.Exit(1)
	}
}

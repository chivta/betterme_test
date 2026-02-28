package main

import (
	"context"
	"log"
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
	cfg := config.Load()
	err := config.Validate(cfg)
	if err != nil {
		log.Fatalf("Config validation failed: %v", err)
	}

	// --- Postgres ---
	db, err := gorm.Open(postgres.Open(cfg.DB.DatabaseURL), &gorm.Config{})
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

	// --- Redis ---
	redisOpts, err := redis.ParseURL(cfg.Cache.RedisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	rdb := redis.NewClient(redisOpts)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}

	// --- Repos ---
	taxRepo   := repo.NewTaxRepo(db, rdb)
	orderRepo := repo.NewOrderRepo(db)
	userRepo  := repo.NewUserRepo(db)
	tokenRepo := repo.NewTokenRepo(rdb)

	// --- Services ---
	taxService   := service.NewTaxService(taxRepo)
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
	orders.Post("/", orderHandler.CreateOrder)
	orders.Get("/", orderHandler.ListOrders)

	log.Printf("Server starting on :%s", cfg.Server.Port)
	log.Printf("Swagger UI available at http://localhost:%s/swagger/index.html", cfg.Server.Port)
	if err := app.Listen(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

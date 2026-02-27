package config

import (
	"fmt"
	"os"
	"reflect"
	"strconv"

	"github.com/go-playground/validator/v10"
)

type Config struct {
	Server struct {
		Port				string `env:"SERVER_PORT" default:"8080"`
		FrontendURL			string `env:"FRONTEND_URL" default:"http://localhost:3000"`
	}
	DB struct {
		DatabaseURL			string `env:"DATABASE_URL" default:"postgres://app:secret@localhost:5432/taxcalc?sslmode=disable"`
	}
	Cache struct {
		RedisURL			string `env:"REDIS_URL" default:"redis://localhost:6379"`
	}
	Auth struct {
		JWTSecret			string `env:"JWT_SECRET" default:"super-secret-jwt-key-change-in-prod"`
	
		GoogleClientID		string `env:"GOOGLE_CLIENT_ID" validate:"required"`
		GoogleClientSecret	string `env:"GOOGLE_CLIENT_SECRET" validate:"required"`
		GoogleRedirectURL	string `env:"GOOGLE_REDIRECT_URL" defalut:"http://localhost:8080/api/auth/google/callback"`
	}
}

func Load() *Config {
	cfg := &Config{}

	if err := mapEnvToStruct(cfg); err != nil {
		panic(err)
	}
	return cfg
}

func mapEnvToStruct(ptr interface{}) error {
	v := reflect.ValueOf(ptr).Elem()
	t := v.Type()

	for i := 0; i < v.NumField(); i++ {
		fieldV := v.Field(i)
		structField := t.Field(i)

		if fieldV.Kind() == reflect.Struct {
			if err := mapEnvToStruct(fieldV.Addr().Interface()); err != nil {
				return err
			}
			continue
		}

		envKey := structField.Tag.Get("env")
		if envKey == "" {
			continue
		}

		envVal := os.Getenv(envKey)
		if envVal == "" {
			envVal = structField.Tag.Get("default")
		}

		if envVal == "" {
			continue
		}
		
		switch fieldV.Kind() {
		case reflect.String:
			fieldV.SetString(envVal)
		case reflect.Int, reflect.Int64:
			val, err := strconv.Atoi(envVal)
			if err != nil {
				return fmt.Errorf("field %s: invalid int value %q", structField.Name, envVal)
			}
			fieldV.SetInt(int64(val))
		case reflect.Bool:
			boolVal, err := strconv.ParseBool(envVal)
			if err != nil {
				return fmt.Errorf("field %s: invalid bool value %q", structField.Name, envVal)
			}
			fieldV.SetBool(boolVal)
		default:
			return fmt.Errorf("field %s: unsupported type %s", structField.Name, fieldV.Kind())
		}
	}
	return nil
}

func Validate(cfg *Config) error {
	validate := validator.New()
	if err := validate.Struct(cfg); err != nil {
		return fmt.Errorf("config validation failed: %v", err)
	}
	return nil
}
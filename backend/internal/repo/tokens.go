package repo

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"taxcalc/internal/apperr"
)

const tokenKeyPrefix = "refresh:"

// TokenRepo stores opaque refresh token hashes in Redis.
// Redis TTL handles expiry natively, eliminating the need for the
// refresh_tokens Postgres table.
type TokenRepo struct {
	client *redis.Client
}

func NewTokenRepo(client *redis.Client) *TokenRepo {
	return &TokenRepo{client: client}
}

func (r *TokenRepo) Store(hash string, userID uint, ttl time.Duration) error {
	ctx := context.Background()
	return r.client.Set(ctx, tokenKeyPrefix+hash, userID, ttl).Err()
}

// FindByHash looks up a token hash. Returns apperr.ErrTokenInvalid when the
// token does not exist or has expired. Unexpected Redis errors are logged and
// also surfaced as ErrTokenInvalid — the caller always gets a clean sentinel
// and the handler sends 401 regardless of the underlying cause.
func (r *TokenRepo) FindByHash(hash string) (uint, error) {
	ctx := context.Background()
	val, err := r.client.Get(ctx, tokenKeyPrefix+hash).Result()
	if err == redis.Nil {
		return 0, apperr.ErrTokenInvalid
	}
	if err != nil {
		slog.Error("repo: get token error", "err", err)
		return 0, apperr.ErrTokenInvalid
	}

	id, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("repo: corrupt token value: %w", err)
	}
	return uint(id), nil
}

func (r *TokenRepo) Delete(hash string) error {
	ctx := context.Background()
	return r.client.Del(ctx, tokenKeyPrefix+hash).Err()
}

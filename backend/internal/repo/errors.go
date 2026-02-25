package repo

import "errors"

// ErrNotFound is returned by repo implementations when a record does not exist.
// Consumers check with errors.Is(err, repo.ErrNotFound).
var ErrNotFound = errors.New("not found")

// Package apperr defines sentinel errors for expected failure conditions.
// Services wrap these with fmt.Errorf("%w: <detail>", apperr.ErrXxx) so that
// handlers can classify responses via errors.Is while the full err.Error()
// string — sentinel message + appended detail — is what reaches the client.
//
// Rule: 4xx sentinels are safe to send verbatim to the client.
//       Everything else is an internal error: log it, return a generic message.
package apperr

import "errors"

// 401 Unauthorized

// ErrInvalidCredentials is returned when email/password do not match.
// Deliberately generic — does not reveal whether the email exists.
var ErrInvalidCredentials = errors.New("email or password is incorrect")

// ErrGoogleAuthOnly is returned when a user who registered via Google
// attempts to log in with a password.
var ErrGoogleAuthOnly = errors.New("this account was created with Google sign-in — use the 'Sign in with Google' option")

// ErrTokenInvalid is returned when a refresh token is missing, expired,
// or cannot be found in the store.
var ErrTokenInvalid = errors.New("refresh token is invalid or expired — please log in again")

// 400 Bad Request

// ErrInvalidTimestamp is returned when an order timestamp cannot be parsed.
// Wrap with the received value: fmt.Errorf("%w: received %q", ErrInvalidTimestamp, val)
var ErrInvalidTimestamp = errors.New("invalid timestamp format — accepted formats: RFC3339 (2006-01-02T15:04:05Z) or 'YYYY-MM-DD HH:MM:SS'")

// ErrInvalidCSV is returned when the uploaded file is not a valid CSV or
// is missing required columns (latitude, longitude, subtotal).
// Wrap with the specific problem: fmt.Errorf("%w: <detail>", ErrInvalidCSV)
var ErrInvalidCSV = errors.New("invalid CSV")

// ErrOutOfBounds is returned when the given coordinates do not fall inside
// any recognised NY state county.
// Wrap with the coordinates: fmt.Errorf("%w: received (lat, lon)", ErrOutOfBounds)
var ErrOutOfBounds = errors.New("coordinates are outside any recognized NY jurisdiction")


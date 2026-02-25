# API Error Reference

## Response format

Every error response uses the same JSON envelope:

```json
{
  "error": "description of what went wrong"
}
```

The HTTP status code is the primary signal for error class. The `error` string is human-readable and intended to be shown to the user or logged for debugging.

**4xx errors** describe a mistake the client made — the message explains what went wrong and how to fix it.
**500 errors** are server-side failures — the message is always the generic string `"internal server error"` to avoid leaking internals. Check server logs for the real cause.

---

## Authentication

All order endpoints require a valid JWT access token:

```
Authorization: Bearer <access_token>
```

| Condition | Status | `error` |
|-----------|--------|---------|
| `Authorization` header absent | `401` | `authorization header is missing — add 'Authorization: Bearer <token>' to your request` |
| Header not in `Bearer <token>` form | `401` | `authorization header format is invalid — expected 'Authorization: Bearer <token>'` |
| Token invalid, tampered, or expired | `401` | `access token is invalid or expired — use POST /api/auth/refresh to get a new one` |

Access tokens expire after **15 minutes**. Use the refresh endpoint to obtain a new pair without re-authenticating.

---

## `POST /api/auth/login`

| Condition | Status | `error` |
|-----------|--------|---------|
| Malformed or non-JSON body | `400` | `request body must be valid JSON` |
| `email` or `password` field missing or empty | `400` | `both 'email' and 'password' fields are required` |
| Email not found, or password incorrect | `401` | `email or password is incorrect` |
| Account registered via Google (no password set) | `401` | `this account was created with Google sign-in — use the 'Sign in with Google' option` |

> The `401` message for wrong credentials is intentionally the same whether the email exists or not, to prevent user enumeration.

**Success `200`:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<opaque>",
  "expires_in": 900
}
```

---

## `POST /api/auth/refresh`

Exchange a refresh token for a new token pair. The submitted token is consumed on use — store the new one.

| Condition | Status | `error` |
|-----------|--------|---------|
| Malformed or non-JSON body | `400` | `request body must be valid JSON` |
| `refresh_token` field missing or empty | `400` | `'refresh_token' field is required` |
| Token not found, already used, or expired | `401` | `refresh token is invalid or expired — please log in again` |

Refresh tokens are valid for **7 days** and are single-use. After a successful refresh, the old token is invalidated immediately.

---

## `POST /api/auth/logout`

Always returns `200` regardless of whether the token existed. Logout is best-effort and idempotent.

| Condition | Status | `error` |
|-----------|--------|---------|
| Malformed body | `400` | `request body must be valid JSON` |

---

## `GET /api/auth/google`

| Condition | Status | `error` |
|-----------|--------|---------|
| Google OAuth not configured on the server | `501` | `Google OAuth not configured` |

On success, redirects to Google's consent screen.

---

## `GET /api/auth/google/callback`

| Condition | Status | `error` |
|-----------|--------|---------|
| `code` query parameter missing | `400` | `'code' query parameter is missing from the OAuth callback` |
| Google OAuth not configured | `501` | `Google OAuth not configured` |
| OAuth exchange or user-info fetch failed | `500` | `internal server error` |

On success, redirects to `{FRONTEND_URL}/auth/callback?access_token=...&refresh_token=...`

---

## `POST /api/orders`

Requires authentication.

| Condition | Status | `error` |
|-----------|--------|---------|
| Malformed or non-JSON body | `400` | `request body must be valid JSON` |
| `subtotal` is zero or negative | `400` | `'subtotal' must be greater than 0` |
| `latitude` out of range | `400` | `'latitude' must be between -90 and 90` |
| `longitude` out of range | `400` | `'longitude' must be between -180 and 180` |
| `timestamp` provided but unparseable | `400` | `invalid timestamp format — accepted formats: RFC3339 (2006-01-02T15:04:05Z) or 'YYYY-MM-DD HH:MM:SS': received "<value>"` |
| Coordinates fall outside NY state | `400` | `coordinates are outside any recognized NY jurisdiction: received (<lat>, <lon>)` |

**Accepted timestamp formats** (field is optional — defaults to current server time):
- RFC3339: `2006-01-02T15:04:05Z` or `2006-01-02T15:04:05-05:00`
- Plain datetime: `2006-01-02 15:04:05`

**Success `201`:** full order object with calculated tax fields.

---

## `POST /api/orders/import`

Requires authentication. Send a `multipart/form-data` request with a `file` field containing the CSV.

**Request-level errors** (whole request rejected):

| Condition | Status | `error` |
|-----------|--------|---------|
| No `file` field in the form | `400` | `no file received — send a CSV file in the 'file' form field (multipart/form-data)` |
| File is not readable as CSV | `400` | `invalid CSV: could not read the header row — ensure the file is a valid CSV` |
| Required column missing | `400` | `invalid CSV: missing required column "<name>" — the CSV must have 'latitude', 'longitude', and 'subtotal' columns` |

**Required columns:** `latitude`, `longitude`, `subtotal`
**Optional columns:** `id` (external ID), `timestamp`

**Row-level errors** (import proceeds, failures reported inline):

Individual row failures do not abort the import. They are collected and returned in the response body:

```json
{
  "total_imported": 950,
  "total_failed": 50,
  "total_tax": 12345.67,
  "errors": [
    "line 3: 'latitude' must be a decimal number, got \"abc\"",
    "line 7: 'subtotal' must be a decimal number, got \"\"",
    "line 12: 'timestamp' format not recognised — use 'YYYY-MM-DD HH:MM:SS' or RFC3339, got \"13/45/2024\"",
    "... and 47 more errors"
  ]
}
```

Row-level error messages:

| Problem | Message |
|---------|---------|
| Non-numeric latitude | `line N: 'latitude' must be a decimal number, got "<value>"` |
| Non-numeric longitude | `line N: 'longitude' must be a decimal number, got "<value>"` |
| Non-numeric subtotal | `line N: 'subtotal' must be a decimal number, got "<value>"` |
| Unrecognised timestamp | `line N: 'timestamp' format not recognised — use 'YYYY-MM-DD HH:MM:SS' or RFC3339, got "<value>"` |

> The `errors` array is capped at **10 entries** in the response. The full list is available in server logs.
> A response with `total_imported: 0` means every row failed — check the `errors` array.

---

## `GET /api/orders`

Requires authentication. Accepts query parameters: `page`, `page_size`, `county`, `date_from`, `date_to`, `min_total`, `max_total`.

Invalid numeric filter values (`min_total`, `max_total`) are silently ignored and the filter is skipped. Invalid `page` or `page_size` default to `1` and `20` respectively.

No client-specific errors beyond the shared authentication errors above.

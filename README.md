# Instant Wellness Kits — NY Sales Tax Calculator

A full-stack application that calculates New York State composite sales tax for drone-delivered wellness kit orders. Given delivery coordinates (latitude, longitude), the system determines which NY county the delivery falls in and applies the correct state, county, city, and MCTD tax rates.

## Quick Start

```bash
docker-compose up --build
```

Once all three containers are running:

| Service    | URL                                  |
|------------|--------------------------------------|
| Frontend   | http://localhost:3000                 |
| Backend    | http://localhost:8080                 |
| Swagger UI | http://localhost:8080/swagger/index.html |

### Test Account

| Email            | Password  |
|------------------|-----------|
| admin@test.com   | admin123  |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Frontend   │────▶│    Backend API   │────▶│ PostgreSQL+PostGIS│
│  React+Vite  │     │   Go (Fiber)     │     │                   │
│  shadcn/ui   │     │   GORM ORM       │     │  jurisdictions    │
│  React Query │     │   Swagger UI     │     │  tax_rates        │
│  TailwindCSS │     │   JWT Auth       │     │  orders           │
└─────────────┘     └──────────────────┘     └───────────────────┘
     :3000               :8080                     :5432
```

### Tax Calculation Flow

1. **Input**: latitude, longitude, subtotal
2. **Spatial Lookup**: PostGIS `ST_Contains` query matches coordinates against NY county boundary polygons
3. **Rate Lookup**: Join with `tax_rates` table to get state/county/city/MCTD rates
4. **Calculation**: `tax_amount = subtotal * composite_rate`, `total = subtotal + tax`

### Tech Stack

- **Backend**: Go 1.22, Fiber v2, GORM, swaggo/swag
- **Frontend**: React 18, Vite, TypeScript, TanStack Query, shadcn/ui + TweakCN, Tailwind CSS
- **Database**: PostgreSQL 16 with PostGIS 3.4
- **Infrastructure**: Docker Compose

## API Endpoints

All order endpoints require authentication (`Authorization: Bearer <token>`).

### Auth

| Method | Endpoint                       | Description                        |
|--------|--------------------------------|------------------------------------|
| POST   | `/api/auth/login`              | Login with email/password          |
| POST   | `/api/auth/refresh`            | Refresh access token               |
| POST   | `/api/auth/logout`             | Invalidate refresh token           |
| GET    | `/api/auth/google`             | Initiate Google OAuth flow         |
| GET    | `/api/auth/google/callback`    | Google OAuth callback              |

### Orders

| Method | Endpoint              | Description                          |
|--------|-----------------------|--------------------------------------|
| POST   | `/api/orders/import`  | Import CSV (multipart/form-data)     |
| POST   | `/api/orders`         | Create single order (JSON)           |
| GET    | `/api/orders`         | List orders (paginated + filters)    |

#### Query Parameters for GET /api/orders

| Param      | Type   | Description                 |
|------------|--------|-----------------------------|
| page       | int    | Page number (default: 1)    |
| page_size  | int    | Items per page (default: 20)|
| county     | string | Filter by county name       |
| date_from  | string | Start date (YYYY-MM-DD)     |
| date_to    | string | End date (YYYY-MM-DD)       |
| min_total  | number | Minimum total amount        |
| max_total  | number | Maximum total amount        |

## Authentication

The system supports two authentication methods:

### 1. Email/Password
- Access token (JWT, 15min TTL) in `Authorization: Bearer` header
- Refresh token (opaque, 7-day TTL) stored server-side, used to obtain new access tokens
- Token rotation: each refresh invalidates the old token and issues a new pair

### 2. Google OAuth2
Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables. To set up:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:8080/api/auth/google/callback` as an authorized redirect URI
4. Set the env vars in `docker-compose.yml` or a `.env` file:
   ```
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

Google OAuth is optional — the app works without it (the button will show an error).

## Tax Data

### Sources

- **County boundaries**: US Census Bureau Cartographic Boundary Files (plotly/datasets GeoJSON), loaded into PostGIS on first startup
- **Tax rates**: NY State Publication 718 (effective March 2025) and [salestaxhandbook.com](https://salestaxhandbook.com/new-york/rates)

### NY Sales Tax Structure

| Component     | Rate              | Applies To                                                |
|---------------|-------------------|-----------------------------------------------------------|
| State rate    | 4.000%            | All of New York State                                     |
| County rate   | 3.0%–4.75%        | Varies by county                                          |
| City rate     | 4.500%            | NYC boroughs only (Bronx, Kings, New York, Queens, Richmond) |
| MCTD surcharge| 0.375%            | 12 MCTD counties (NYC + Dutchess, Nassau, Orange, Putnam, Rockland, Suffolk, Westchester) |

### Example Rates

| Jurisdiction          | State | County | City  | MCTD  | Total  |
|-----------------------|-------|--------|-------|-------|--------|
| NYC (any borough)     | 4.0%  | 0.0%   | 4.5%  | 0.375%| 8.875% |
| Nassau County         | 4.0%  | 4.25%  | 0.0%  | 0.375%| 8.625% |
| Erie County (Buffalo) | 4.0%  | 4.75%  | 0.0%  | 0.0%  | 8.75%  |
| Tompkins (Ithaca)     | 4.0%  | 4.0%   | 0.0%  | 0.0%  | 8.0%   |
| Ontario               | 4.0%  | 3.5%   | 0.0%  | 0.0%  | 7.5%   |

### Assumptions & Limitations

1. **County-level resolution**: Tax rates are determined at the county level using PostGIS spatial queries. City-level rate variations within a county (e.g., Yonkers vs. rest of Westchester) are not captured — the county-level rate applies uniformly.

2. **Static rates**: Tax rates are seeded at startup from a compiled table. Rate changes require updating the seed data and restarting the backend.

3. **NY State only**: Coordinates outside NY State boundaries will fail tax calculation with an error. The CSV input is expected to contain only NY delivery coordinates.

4. **GeoJSON download**: On first startup, the backend downloads ~23MB of US county boundary GeoJSON from GitHub (plotly/datasets), filters to NY's 62 counties, and loads them into PostGIS. This requires internet access on first run.

5. **Tribal territories**: Special rates for Native American territories (e.g., Oneida Indian Nation) are not included. Standard county rates apply.

6. **Product exemptions**: Wellness kits are treated as general tangible personal property subject to full sales tax. No exemptions (e.g., clothing under $110) are applied.

## CSV Format

The input CSV must have these columns (order doesn't matter):

```csv
id,longitude,latitude,timestamp,subtotal
1,-73.9857,40.7484,2025-11-04 10:17:04.915,120.0
```

- `id` — external order ID (optional)
- `longitude` — delivery longitude (negative for western hemisphere)
- `latitude` — delivery latitude
- `timestamp` — order timestamp (various formats supported)
- `subtotal` — kit price before tax

## Output

For each order, the system produces:

```json
{
  "id": 1,
  "latitude": 40.7484,
  "longitude": -73.9857,
  "subtotal": 120.00,
  "county_fips": "36061",
  "county_name": "New York",
  "composite_tax_rate": 0.08875,
  "tax_amount": 10.65,
  "total_amount": 130.65,
  "state_rate": 0.04000,
  "county_rate": 0.00000,
  "city_rate": 0.04500,
  "special_rate": 0.00375
}
```

## Development

### Backend (without Docker)

```bash
cd backend
go run ./cmd/api
```

Requires PostgreSQL with PostGIS at `DATABASE_URL`.

### Frontend (without Docker)

```bash
cd frontend
npm install
npm run dev
```

### Customizing the Theme

The UI uses [shadcn/ui](https://ui.shadcn.com) components styled with CSS variables. To customize:

1. Visit [TweakCN](https://tweakcn.com) to generate a theme
2. Replace the CSS variables in `frontend/src/index.css`
3. All components automatically pick up the new theme

## Project Structure

```
├── docker-compose.yml
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── go.mod / go.sum
│   ├── cmd/api/main.go          # Entry point, routing, DI
│   ├── docs/docs.go             # Swagger spec (generated)
│   └── internal/
│       ├── config/              # Environment config
│       ├── handler/             # Fiber HTTP handlers (auth, orders)
│       ├── middleware/          # JWT auth middleware
│       ├── model/               # GORM models
│       ├── repository/          # Database queries
│       ├── seed/                # GeoJSON loader + tax rate seeder
│       └── service/             # Business logic (tax calc, auth, orders)
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    └── src/
        ├── api/                 # API client + React Query hooks
        ├── components/          # ImportCSV, CreateOrder, OrdersTable
        ├── components/ui/       # shadcn/ui primitives
        ├── hooks/               # Auth context
        └── pages/               # Login, Dashboard
```

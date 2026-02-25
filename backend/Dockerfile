# ---- dev stage ----
FROM golang:1.23-alpine AS dev

RUN apk add --no-cache git
RUN go install github.com/air-verse/air@latest

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

# Source is mounted at /app via docker-compose for hot reload
EXPOSE 8080
CMD ["air"]

# ---- build stage ----
FROM golang:1.23-alpine AS build

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api

# ---- prod stage ----
FROM alpine:3.20 AS prod

RUN apk add --no-cache ca-certificates tzdata

COPY --from=build /api /api

EXPOSE 8080
CMD ["/api"]

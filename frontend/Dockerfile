# ---- dev stage ----
FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps && \
    npm install --os=linux --cpu=x64 --libc=musl @rollup/rollup-linux-x64-musl --no-save

# Source is mounted at /app via docker-compose for hot reload
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL

COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps && \
    npm install --os=linux --cpu=x64 --libc=musl @rollup/rollup-linux-x64-musl --no-save

COPY . .
RUN npm run build

# ---- prod stage ----
FROM nginx:alpine AS prod

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

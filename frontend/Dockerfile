# Build stage. Vite inlines the VITE_* values into the bundle, so they are
# build arguments: they are public by nature (Firebase web config, API URL).
FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_BACKEND_URL
ARG VITE_WEBSOCKET_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: static files served by nginx as an unprivileged user.
FROM nginx:1.29-alpine AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
RUN mkdir -p /tmp/nginx && chown -R nginx:nginx /tmp/nginx && rm -f /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

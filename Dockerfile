# syntax=docker/dockerfile:1

# ---------- Étape 1 : build du frontend (Vite) ----------
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Étape 2 : backend + build du frontend ----------
FROM node:20-slim
WORKDIR /app/backend

# Dépendances backend (production uniquement)
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Code backend
COPY backend/ ./

# Build du frontend copié à l'emplacement attendu par app.js (../../frontend/dist)
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Droits réduits : voir docker-entrypoint.sh (le serveur tourne sous « node »)
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]

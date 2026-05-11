# ---- Stage 1: Frontend build ----
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: Backend + built frontend ----
FROM node:20-alpine
WORKDIR /app

# Backend bağımlılıkları
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

# Backend kaynak kodu
COPY backend/ ./backend/

# Vite build çıktısı
COPY --from=frontend /app/dist ./dist

# Uploads klasörü kalıcı olsun
RUN mkdir -p backend/uploads

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "backend/backend-api.js"]

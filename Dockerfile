FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
USER node
EXPOSE 5000
CMD ["node", "backend/server.js"]

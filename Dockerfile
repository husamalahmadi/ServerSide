# API + Vite client (dist). Deploy to Railway, Render, Fly.io, etc.
# Build args (set in your host: same values as Cloudflare env for the frontend):
#   VITE_TWELVEDATA_API_KEY, VITE_API_URL (must be this service's public HTTPS URL, e.g. https://trueprice-api.onrender.com)
# Runtime env: CLIENT_URL, SERVER_URL, SESSION_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

FROM node:20-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_TWELVEDATA_API_KEY
ARG VITE_API_URL
ARG VITE_BLOGGER_BLOG_ID
ARG VITE_BLOGGER_API_KEY
ENV VITE_TWELVEDATA_API_KEY=${VITE_TWELVEDATA_API_KEY}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_BLOGGER_BLOG_ID=${VITE_BLOGGER_BLOG_ID}
ENV VITE_BLOGGER_API_KEY=${VITE_BLOGGER_API_KEY}
RUN npm run build

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci
COPY server ./server
COPY --from=frontend /app/server/static ./server/static
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/server.js"]

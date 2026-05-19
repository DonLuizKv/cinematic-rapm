# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm (matches pnpm-lock.yaml)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install all dependencies (including dev, needed for tsc)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and compile TypeScript → dist/
COPY tsconfig.json ./
COPY src/ ./src/
RUN pnpm run build

# ── Stage 2: Production ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm in the runner image
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Expose the port the backend listens on (see Env.Global.PORT → 5000)
EXPOSE 5000

CMD ["node", "dist/index.js"]
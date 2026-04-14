FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml components.json ./
COPY tsconfig.app.json tsconfig.json tsconfig.node.json vite.config.ts eslint.config.js index.html ./
COPY public public
COPY src src

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM nginx:alpine

COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80 || exit 1
CMD ["nginx", "-g", "daemon off;"]

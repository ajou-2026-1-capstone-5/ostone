FROM nginx:alpine

# Note: Run `pnpm build` before docker build to generate dist/
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

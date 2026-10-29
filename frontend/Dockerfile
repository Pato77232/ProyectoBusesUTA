# WEB-01: servidor fijo reutilizado de FRONT-01 T2; ver README.md.
FROM nginx:1.30.6-alpine3.24-slim@sha256:dede8895648b461178c3bc604f7eed4423efe5220b2c4d839f5eb3d34ac3f8f7

RUN rm /etc/nginx/conf.d/default.conf /usr/share/nginx/html/50x.html
COPY nginx-proxy.conf /etc/nginx/nginx.conf
COPY proxy-api.conf /etc/nginx/proxy-api.conf
COPY index.html /usr/share/nginx/html/index.html
COPY src/styles/app.css /usr/share/nginx/html/src/styles/app.css
COPY assets /usr/share/nginx/html/assets

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

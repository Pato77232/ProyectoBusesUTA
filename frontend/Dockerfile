# FRONT-01: modo estático por defecto; Compose selecciona el proxy explícitamente.
FROM nginx:1.30.6-alpine3.24-slim@sha256:dede8895648b461178c3bc604f7eed4423efe5220b2c4d839f5eb3d34ac3f8f7

RUN rm /etc/nginx/conf.d/default.conf /usr/share/nginx/html/50x.html
COPY nginx.conf /etc/nginx/nginx.conf
COPY nginx-proxy.conf /etc/nginx/nginx-proxy.conf
COPY proxy-api.conf /etc/nginx/proxy-api.conf
COPY index.html /usr/share/nginx/html/index.html
COPY pages/registrar-bus.html /usr/share/nginx/html/pages/registrar-bus.html
COPY pages/login.html /usr/share/nginx/html/pages/login.html
COPY src/auth /usr/share/nginx/html/src/auth
COPY src/fleet /usr/share/nginx/html/src/fleet
COPY src/styles/app.css /usr/share/nginx/html/src/styles/app.css
COPY src/styles/login.css /usr/share/nginx/html/src/styles/login.css
COPY src/api /usr/share/nginx/html/src/api
COPY assets /usr/share/nginx/html/assets

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

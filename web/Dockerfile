FROM nginx:1.27-alpine
# Railway PORT'u verir; nginx imajı templates/ altındaki dosyaları envsubst ile işler
ENV PORT=8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/Dockerfile /usr/share/nginx/html/nginx.conf.template

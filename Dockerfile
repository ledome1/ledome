FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache chromium font-noto
ENV CHROME_PATH=/usr/bin/chromium-browser
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]

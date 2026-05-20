FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --only=production
COPY backend/ .
COPY index.html styles.css script.js ./public/
RUN mkdir -p uploads
EXPOSE 3001
CMD ["node", "server.js"]

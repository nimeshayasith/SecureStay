FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force
COPY src ./src
EXPOSE 4000
CMD ["npm", "start"]

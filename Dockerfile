FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY config ./config
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=3000 DATA_FILE=/data/registrations.json
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]

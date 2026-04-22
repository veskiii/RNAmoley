FROM ghcr.io/veskiii/dnatco-cli:2026-04-22

ENV NODE_ENV=production

WORKDIR /webserver
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3001
ENTRYPOINT []
CMD ["npm", "start"]

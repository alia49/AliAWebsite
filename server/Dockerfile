# Build from the REPOSITORY ROOT so src/content/profile.json is included:
#   docker build -f server/Dockerfile -t websitedemo-api .
#   docker run -p 8787:8787 -v websitedemo-data:/data -e ANTHROPIC_API_KEY=... websitedemo-api
# server/Dockerfile.dockerignore keeps the build context to just the files below.
FROM node:24-slim

ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/site.db \
    PROFILE_PATH=/app/src/content/profile.json

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY src/content/profile.json /app/src/content/profile.json

# Runs as root so it can write to host-mounted volumes (Fly volumes are root-owned).
# If your volume is writable by uid 1000, add: RUN mkdir -p /data && chown node:node /data / USER node
RUN mkdir -p /data
EXPOSE 8787
CMD ["node", "src/index.js"]

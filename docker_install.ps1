# Wrapper to install dependencies using Docker (no local Node required)
docker run --rm -v ${PWD}:/app -w /app node:24-alpine sh -c "npm install && npm run vendor"

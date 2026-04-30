FROM node:20-bookworm-slim

WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

EXPOSE 5173

CMD ["bash", "-lc", "sleep infinity"]

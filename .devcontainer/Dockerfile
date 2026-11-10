# Dev image shared by the api and web services (same pattern as dona-pilar).
FROM python:3.13-slim

RUN apt-get update && apt-get install -y \
      curl \
      ca-certificates \
      && rm -rf /var/lib/apt/lists/*

# Node 22 for Vite
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# uv (fast Python installer) into /usr/local/bin so all users can use it
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh

RUN groupadd --gid 1000 developer \
    && useradd --uid 1000 --gid 1000 -m developer \
    # Pre-create the node_modules mount point so the named volume is owned by developer
    && mkdir -p /app/frontend/node_modules \
    && chown -R developer:developer /app

USER developer

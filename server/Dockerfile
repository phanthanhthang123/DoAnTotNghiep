FROM node:20-slim

# Install python3, pip, and venv support
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Set up HM directory first
COPY ./HM /HM

# Create a Python virtual environment to avoid system-level package conflicts
RUN python3 -m venv /HM/.venv

# Install ML dependencies inside the venv (pinned to match trained model versions)
RUN /HM/.venv/bin/pip install --no-cache-dir \
    "numpy>=1.24.0,<2.0.0" \
    "scikit-learn==1.7.2" \
    "joblib>=1.3.0" \
    "pandas>=2.0.0"

# Set environment variables so Node.js services know where Python and HM are
ENV PYTHON_PATH=/HM/.venv/bin/python
ENV HM_ROOT=/HM

WORKDIR /app

# Copy package files first for better caching
COPY ./server/package.json ./server/package-lock.json ./
COPY ./server/.babelrc ./

# Install all Node dependencies
RUN npm ci

# Copy server source code
COPY ./server .

# Make entrypoint script executable
RUN chmod +x docker-entrypoint.sh

# Expose port
EXPOSE 5000

# Clear entrypoint inherited from base image
ENTRYPOINT []

# Run migrations and start server
CMD ["sh", "-c", "npx sequelize-cli db:migrate && npx nodemon --exec babel-node server.js"]

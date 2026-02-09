FROM python:3.11-alpine

# Install dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    linux-headers

# Install Python packages
RUN pip install --no-cache-dir \
    flask==2.3.3 \
    gunicorn==21.2.0 \
    requests==2.31.0 \
    pyyaml==6.0.1

# Copy application
# Cache-bust: 20250209-1530
COPY app/ /app/
COPY static/ /app/static/
COPY config.yaml /app/config.yaml

# Copy templates last (they contain version numbers that change frequently)
# Cache-bust: 20250209-1530
COPY templates/ /app/templates/

# Force no-cache for templates - touch all files to ensure fresh
RUN chmod -R 644 /app/templates/* && touch /app/templates/*
COPY run.sh /

# Make run script executable
RUN chmod +x /run.sh

# Set working directory
WORKDIR /app

# Expose port
EXPOSE 8099

# Start the application
CMD ["/run.sh"]

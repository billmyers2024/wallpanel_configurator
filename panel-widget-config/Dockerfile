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
    requests==2.31.0

# Copy application (static files first for layer caching)
COPY app/ /app/
COPY templates/ /app/templates/
COPY static/ /app/static/

# Force cache bust for static files
RUN find /app/static -type f -exec chmod 644 {} \; && \
    find /app/templates -type f -exec chmod 644 {} \;
COPY run.sh /

# Make run script executable
RUN chmod +x /run.sh

# Set working directory
WORKDIR /app

# Expose port
EXPOSE 8099

# Start the application
CMD ["/run.sh"]

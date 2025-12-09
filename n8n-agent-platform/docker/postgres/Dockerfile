FROM postgres:15-alpine

# Instalar dependencias de compilación incluyendo clang
RUN apk add --no-cache \
    git \
    build-base \
    postgresql-dev \
    clang15 \
    llvm15

# Clonar y compilar pgvector
RUN cd /tmp && \
    git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git && \
    cd pgvector && \
    make USE_PG_CONFIG=/usr/local/bin/pg_config && \
    make install USE_PG_CONFIG=/usr/local/bin/pg_config && \
    cd .. && \
    rm -rf pgvector

# Limpiar dependencias de compilación
RUN apk del git build-base postgresql-dev clang15 llvm15

# Script de inicialización para crear la extensión
RUN echo "CREATE EXTENSION IF NOT EXISTS vector;" > /docker-entrypoint-initdb.d/00-create-extensions.sql
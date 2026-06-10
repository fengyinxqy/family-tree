#!/bin/bash
set -e

echo "=== 家谱系统初始化 ==="

# Start PostgreSQL
echo ">> 启动 PostgreSQL..."
docker compose up -d postgres

# Wait for PostgreSQL
echo ">> 等待 PostgreSQL 就绪..."
until docker compose exec -T postgres pg_isready -U family -d familydb; do
  sleep 2
done

# Run Prisma migration
echo ">> 运行数据库迁移..."
npx prisma migrate dev --name init

# Build and start
echo ">> 构建并启动应用..."
docker compose up -d --build

echo "=== 初始化完成 ==="
echo "打开 http://localhost:3000 访问家谱系统"

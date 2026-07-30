#!/bin/bash
# production database deployment pipeline

echo -e "\e[1;34m🚀 Launching Q/C Quiz Class Production Deploy & DB Pipeline...\e[0m"

# 1. Build and spin up the Docker containers
echo -e "\e[1;32m🐳 Building and starting Docker services...\e[0m"
docker-compose up -d --build

# 2. Pause to allow PostgreSQL container to start completely
echo -e "\e[1;33m⏳ Waiting 8 seconds for PostgreSQL service to initialize...\e[0m"
sleep 8

# 3. Synchronize schema using Prisma on PostgreSQL
echo -e "\e[1;32m⚙️ Applying database migration schema through Prisma...\e[0m"
docker-compose exec -T backend npx prisma db push

echo -e "\e[1;36m🎉 Production Deploy & DB Pipeline completed successfully!\e[0m"
echo -e "   Frontend is live at: http://localhost:3000"
echo -e "   Backend is live at:  http://localhost:4000"

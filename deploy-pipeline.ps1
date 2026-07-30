Write-Host "🚀 Launching Q/C Quiz Class Production Deploy & DB Pipeline..." -ForegroundColor Blue

# 1. Build and spin up the Docker containers
Write-Host "🐳 Building and starting Docker services..." -ForegroundColor Green
docker-compose up -d --build

# 2. Pause to allow PostgreSQL container to start completely
Write-Host "⏳ Waiting 8 seconds for PostgreSQL service to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 3. Synchronize schema using Prisma on PostgreSQL
Write-Host "⚙️ Applying database migration schema through Prisma..." -ForegroundColor Green
docker-compose exec -T backend npx prisma db push

Write-Host "🎉 Production Deploy & DB Pipeline completed successfully!" -ForegroundColor Cyan
Write-Host "   Frontend is live at: http://localhost:3000" -ForegroundColor White
Write-Host "   Backend is live at:  http://localhost:4000" -ForegroundColor White

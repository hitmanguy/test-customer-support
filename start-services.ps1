# Start Customer Support AI System
Write-Host "Starting Customer Support AI System..." -ForegroundColor Cyan

# Start the Python AI microservice in a new window
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot\Agent_Ai'; python -m uvicorn main:app --reload --port 8000`""

# Wait for a moment to let the Python service start
Write-Host "Waiting for Python microservice to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Start the NestJS backend in a new window
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PSScriptRoot\apps\server'; pnpm run start:dev`""

Write-Host "Services started successfully!" -ForegroundColor Green
Write-Host "- Python AI Microservice: http://localhost:8000" -ForegroundColor Green
Write-Host "- NestJS Backend: http://localhost:3000" -ForegroundColor Green
Write-Host "- API Documentation (Python): http://localhost:8000/docs" -ForegroundColor Green

@echo off
echo Starting Customer Support AI System...

:: Start the Python AI microservice in a new window
start cmd /k "cd /d %~dp0Agent_Ai && python -m uvicorn main:app --reload --port 8000"

:: Wait for a moment to let the Python service start
timeout /t 5

:: Start the NestJS backend in a new window
start cmd /k "cd /d %~dp0apps\server && pnpm run start:dev"

echo Services started successfully!
echo - Python AI Microservice: http://localhost:8000
echo - NestJS Backend: http://localhost:3000
echo - API Documentation (Python): http://localhost:8000/docs

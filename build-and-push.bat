@echo off
REM =============================================================================
REM Build and Push Docker Images to Docker Hub
REM =============================================================================
REM Usage: build-and-push.bat yourdockerhubusername [tag]
REM Example: build-and-push.bat lokeshshriwas latest
REM =============================================================================

if "%1"=="" (
    echo Usage: build-and-push.bat ^<docker-hub-username^> [tag]
    echo Example: build-and-push.bat lokeshshriwas latest
    exit /b 1
)

set DOCKER_USER=%1
set TAG=%2
if "%TAG%"=="" set TAG=latest

echo.
echo ============================================
echo Building and pushing images to Docker Hub
echo User: %DOCKER_USER%
echo Tag: %TAG%
echo ============================================
echo.

REM Login to Docker Hub
echo Logging in to Docker Hub...
docker login
if %ERRORLEVEL% NEQ 0 (
    echo Failed to login to Docker Hub
    exit /b 1
)

REM Build and push API
echo.
echo [1/4] Building API...
cd api
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Failed to build API
    exit /b 1
)
docker build -t %DOCKER_USER%/exchange-api:%TAG% .
docker push %DOCKER_USER%/exchange-api:%TAG%
cd ..

REM Build and push Engine
echo.
echo [2/4] Building Engine...
cd engine
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Failed to build Engine
    exit /b 1
)
docker build -t %DOCKER_USER%/exchange-engine:%TAG% .
docker push %DOCKER_USER%/exchange-engine:%TAG%
cd ..

REM Build and push WS
echo.
echo [3/4] Building WS...
cd ws
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Failed to build WS
    exit /b 1
)
docker build -t %DOCKER_USER%/exchange-ws:%TAG% .
docker push %DOCKER_USER%/exchange-ws:%TAG%
cd ..

REM Build and push DB Worker
echo.
echo [4/4] Building DB Worker...
cd db
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Failed to build DB Worker
    exit /b 1
)
docker build -t %DOCKER_USER%/exchange-db-worker:%TAG% .
docker push %DOCKER_USER%/exchange-db-worker:%TAG%
cd ..

echo.
echo ============================================
echo All images pushed successfully!
echo ============================================
echo.
echo Images:
echo   - %DOCKER_USER%/exchange-api:%TAG%
echo   - %DOCKER_USER%/exchange-engine:%TAG%
echo   - %DOCKER_USER%/exchange-ws:%TAG%
echo   - %DOCKER_USER%/exchange-db-worker:%TAG%
echo.
echo Next steps on EC2:
echo   1. Copy docker-compose.prod.yml and .env to EC2
echo   2. Update .env with DOCKER_USER=%DOCKER_USER%
echo   3. docker compose -f docker-compose.prod.yml pull
echo   4. docker compose -f docker-compose.prod.yml up -d
echo.

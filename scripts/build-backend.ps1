$ErrorActionPreference = 'Stop'

Write-Host "=== VEY.AI Backend Build ===" -ForegroundColor Green
Write-Host ""

# Step 1: Install required Python packages
Write-Host "[1/3] Installing Python dependencies..." -ForegroundColor Cyan
python -m pip install --quiet pyinstaller fastapi uvicorn pydantic psutil requests sentence-transformers transformers torch pypdf python-docx odf

# Step 2: Clean old build
Write-Host "[2/3] Cleaning old build artifacts..." -ForegroundColor Cyan
if (Test-Path dist/ai_service) {
    Remove-Item dist/ai_service -Recurse -Force
}

# Step 3: Build with PyInstaller
Write-Host "[3/3] Building ai_service.exe with PyInstaller..." -ForegroundColor Cyan
python -m PyInstaller --name ai_service --onedir --noconfirm `
    --hidden-import="uvicorn.logging" `
    --hidden-import="uvicorn.loops" `
    --hidden-import="uvicorn.loops.auto" `
    --hidden-import="uvicorn.protocols" `
    --hidden-import="uvicorn.protocols.http" `
    --hidden-import="uvicorn.protocols.http.auto" `
    --hidden-import="uvicorn.protocols.websockets" `
    --hidden-import="uvicorn.protocols.websockets.auto" `
    --hidden-import="uvicorn.lifespan" `
    --hidden-import="uvicorn.lifespan.on" `
    --hidden-import="fastapi" `
    --hidden-import="pydantic" `
    --hidden-import="docx" `
    --hidden-import="odf" `
    --hidden-import="pypdf" `
    --hidden-import="sentence_transformers" `
    --hidden-import="transformers" `
    --hidden-import="torch" `
    --hidden-import="psutil" `
    --hidden-import="requests" `
    --hidden-import="json" `
    --collect-all="sentence_transformers" `
    --collect-all="transformers" `
    --collect-all="tokenizers" `
    --collect-data="torch" `
    "scripts\ai_service.py"

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host "Executable: dist\ai_service\ai_service.exe"
Write-Host ""
Write-Host "Test it with:" -ForegroundColor Yellow
Write-Host "  .\dist\ai_service\ai_service.exe"

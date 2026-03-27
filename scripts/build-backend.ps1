$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "       VEY.AI Backend Builder             " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Step 1: Check Python
Write-Host "[1/4] Checking Python installation..." -ForegroundColor Cyan
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = $cmd
            Write-Host "  Found: $ver" -ForegroundColor Gray
            break
        }
    } catch {}
}
if (-not $pythonCmd) {
    Write-Host "  ERROR: Python not found! Install Python 3.10+ from python.org" -ForegroundColor Red
    exit 1
}

# Step 2: Install required Python packages
Write-Host "[2/4] Installing Python dependencies..." -ForegroundColor Cyan
& $pythonCmd -m pip install --quiet --upgrade pip
& $pythonCmd -m pip install --quiet pyinstaller fastapi uvicorn pydantic psutil requests sentence-transformers transformers torch pypdf python-docx odf fpdf2

# Step 3: Clean old build
Write-Host "[3/4] Cleaning old build artifacts..." -ForegroundColor Cyan
if (Test-Path dist/ai_service) {
    Remove-Item dist/ai_service -Recurse -Force
}

# Step 4: Build with PyInstaller
Write-Host "[4/4] Building ai_service.exe with PyInstaller..." -ForegroundColor Cyan
& $pythonCmd -m PyInstaller --name ai_service --onedir --noconfirm `
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

if (-not (Test-Path "dist\ai_service\ai_service.exe")) {
    Write-Host ""
    Write-Host "  ERROR: Build failed! ai_service.exe not found." -ForegroundColor Red
    exit 1
}

# Step 5: Copy to Tauri resources
Write-Host ""
Write-Host "[+] Copying backend to Tauri resources..." -ForegroundColor Yellow
$resourcesDir = "vey-v2\src-tauri\resources\ai_service"
if (Test-Path $resourcesDir) {
    Remove-Item $resourcesDir -Recurse -Force
}
Copy-Item "dist\ai_service" $resourcesDir -Recurse

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "         Build Complete!                  " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:  dist\ai_service\ai_service.exe" -ForegroundColor Gray
Write-Host "  Resources: $resourcesDir" -ForegroundColor Gray
Write-Host ""
Write-Host "  Next: Run 'cd vey-v2 && npm run tauri build' to create installer" -ForegroundColor Yellow
Write-Host ""

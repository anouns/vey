import sys
import os
import subprocess
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import uvicorn
import psutil
import requests
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global workspace state
CURRENT_WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load models
print("Loading models... (this may take a minute)")
embed_model = SentenceTransformer('all-MiniLM-L6-v2')
model_id = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
tokenizer = AutoTokenizer.from_pretrained(model_id)
device = "cuda" if torch.cuda.is_available() else "cpu"
llm_model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=torch.float32 if device == "cpu" else torch.float16).to(device)
print(f"Models loaded on {device}.")

class ChatRequest(BaseModel):
    messages: list
    model: str = "PYTHON_LOCAL_AI"

class TerminalRequest(BaseModel):
    command: str

class FileWriteRequest(BaseModel):
    filename: str
    content: str

@app.post("/file/write")
async def write_file(request: FileWriteRequest):
    try:
        # Prevent path traversal
        global CURRENT_WORKSPACE
        safe_name = os.path.basename(request.filename)
        target_path = os.path.join(CURRENT_WORKSPACE, safe_name)
        
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {"status": "SUCCESS", "path": target_path}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@app.post("/terminal")
async def execute_command(request: TerminalRequest):
    try:
        cmd = request.command
        # Basic terminal wrapper for Vey OS
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
        output = result.stdout if result.stdout else result.stderr
        return {"output": output or "DONE (No output)"}
    except Exception as e:
        return {"output": f"CRITICAL_ERROR: {str(e)}"}

def get_project_context(root_path=None):
    context_parts = []
    global CURRENT_WORKSPACE
    root_dir = root_path or CURRENT_WORKSPACE
    allowed_exts = {'.rs', '.py', '.js', '.jsx', '.html', '.css', '.toml', '.json', '.md', '.txt'}
    ignore_dirs = {'.git', 'node_modules', 'dist', 'build', '__pycache__'}
    total_chars = 0
    max_chars = 5000 
    
    for root, dirs, filenames in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in allowed_exts:
                file_path = os.path.join(root, f)
                try:
                    with open(file_path, 'r', encoding='utf-8') as file:
                        content = file.read()
                        snippet = f"--- FILE: {os.path.relpath(file_path, root_dir)} ---\n{content}\n"
                        if total_chars + len(snippet) < max_chars:
                            context_parts.append(snippet)
                            total_chars += len(snippet)
                        else: break
                except: continue
        if total_chars >= max_chars: break
    return "\n".join(context_parts)

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        context = get_project_context()
        last_msg = request.messages[-1]['content']
        
        if request.model == "PYTHON_LOCAL_AI":
            prompt = (
                "<|system|>\n"
                "You are VEY AI CORE. Expert in project analysis and modification. "
                "SUPPORT LANGUAGES: English, Russian. "
                "CRITICAL: Always respond in the SAME language as the user's query. "
                "You can request to CREATE or MODIFY files if the user asks. "
                "To request a file change, use this EXACT format in your response:\n"
                "[FILE_REQUEST: filename] NEW CONTENT HERE [/FILE_REQUEST]\n"
                "EXAMPLE:\n"
                "User: Create a hello.txt file with 'Hi'\n"
                "Assistant: I will create the file for you.\n"
                "[FILE_REQUEST: hello.txt] Hi [/FILE_REQUEST]\n"
                "Analyze the provided source code context to answer accurately.\n"
                "CONTEXT:\n"
                f"{context}\n"
                "<|user|>\n"
                f"{last_msg}\n"
                "<|assistant|>\n"
            )
            inputs = tokenizer(prompt, return_tensors="pt").to(device)
            with torch.no_grad():
                outputs = llm_model.generate(**inputs, max_new_tokens=400, temperature=0.3, top_p=0.9, repetition_penalty=1.1, do_sample=True)
            answer = tokenizer.decode(outputs[0], skip_special_tokens=True).split("<|assistant|>")[-1].strip()
            return {"answer": answer}
        
        # Fallbacks for Ollama/Groq (placeholders as before)
        return {"answer": f"ROUTED_TO_{request.model}: Protocol active."}
    except Exception as e:
        return {"answer": f"SYSTEM_ERROR: {str(e)}"}

@app.get("/metrics")
async def get_metrics():
    return {"cpu": psutil.cpu_percent(), "memory": psutil.virtual_memory().percent, "indexing": 100.0}

@app.get("/models/ollama")
async def list_ollama_models():
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=2)
        return {"models": [m['name'] for m in response.json().get('models', [])]} if response.status_code == 200 else {"models": []}
    except: return {"models": []}

@app.get("/workspace/files")
async def list_files(path: str = None):
    try:
        global CURRENT_WORKSPACE
        if path:
            CURRENT_WORKSPACE = path
        
        root_dir = CURRENT_WORKSPACE
        files = []
        for root, dirs, filenames in os.walk(root_dir):
            if ".git" in dirs: dirs.remove(".git")
            if "node_modules" in dirs: dirs.remove("node_modules")
            rel_path = os.path.relpath(root, root_dir)
            if rel_path == ".": continue
            files.append({"name": os.path.basename(root), "type": "directory", "path": rel_path})
            for f in filenames:
                files.append({"name": f, "type": "file", "path": os.path.join(rel_path, f)})
        return {"files": files[:100]}
    except Exception as e: return {"error": str(e)}

if __name__ == "__main__":
    print("Vey AI Core starting on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)

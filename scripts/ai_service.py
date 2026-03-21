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
print("Loading VEY.AI Semantic Databanks... (this may take a minute)")
device = "cuda" if torch.cuda.is_available() else "cpu"

embed_model = SentenceTransformer('all-MiniLM-L6-v2', device=device)

# Advanced Top-Tier Coding LLM Model Upgrade
model_id = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
tokenizer = AutoTokenizer.from_pretrained(model_id)
llm_model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=torch.float32 if device == "cpu" else torch.float16).to(device)
print(f"VEY.AI Core Online on {device}.")

# Intelligent Vector Database Store
DOC_DB = []
EMBED_DB = None
LAST_INDEXED_PATH = None

def build_vector_database(root_dir):
    global DOC_DB, EMBED_DB, LAST_INDEXED_PATH
    if root_dir == LAST_INDEXED_PATH and EMBED_DB is not None: return
    
    print(f"Indexing VEY.AI Massive Databank for: {root_dir}")
    DOC_DB = []
    allowed_exts = {'.rs', '.py', '.js', '.jsx', '.html', '.css', '.toml', '.json', '.md', '.txt', '.txt'}
    ignore_dirs = {'.git', 'node_modules', 'dist', 'build', '__pycache__'}
    
    for root, dirs, filenames in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in allowed_exts:
                file_path = os.path.join(root, f)
                try:
                    with open(file_path, 'r', encoding='utf-8') as file:
                        content = file.read()
                        
                        chunk_size = 900
                        for i in range(0, len(content), chunk_size):
                            snippet = content[i:i+chunk_size]
                            chunk_text = f"--- FILE: {os.path.relpath(file_path, root_dir)} (CHUNk {i//chunk_size}) ---\n{snippet}\n"
                            DOC_DB.append(chunk_text)
                except: continue
                
    if DOC_DB:
        embeddings = embed_model.encode(DOC_DB, convert_to_tensor=True)
        EMBED_DB = embeddings
    else:
        EMBED_DB = None
    LAST_INDEXED_PATH = root_dir
    print(f"VEY.AI Indexing Complete. Databank active with {len(DOC_DB)} vectors.")

def retrieve_top_k(query, k=4):
    if not DOC_DB or EMBED_DB is None: return "NO RELEVANT FILES."
    query_emb = embed_model.encode([query], convert_to_tensor=True)
    cos_scores = torch.nn.functional.cosine_similarity(query_emb, EMBED_DB)
    top_scores, top_idx = torch.topk(cos_scores, min(k, len(DOC_DB)))
    
    retrieved = []
    for idx in top_idx:
        retrieved.append(DOC_DB[idx.item()])
    return "\n".join(retrieved)

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

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        last_msg = request.messages[-1]['content']
        
        if request.model == "PYTHON_LOCAL_AI":
            build_vector_database(CURRENT_WORKSPACE)
            context = retrieve_top_k(last_msg, k=4)
            
            system_instruction = (
                "You are VEY.AI. An extremely advanced and highly optimized software engineering AI. "
                "CRITICAL: ALWAYS respond EXACTLY and EXCLUSIVELY in the Russian language (ОТВЕЧАЙ НА РУССКОМ, код оставляй как есть). "
                "Analyze the provided semantic vector database context to answer accurately. "
                "To request a file change, use EXACT format:\n"
                "[FILE_REQUEST: filename] NEW CONTENT HERE [/FILE_REQUEST]\n"
                "To open a folder:\n"
                "[OPEN_FOLDER: /path/to/folder]\n"
                f"\n--- VEY.AI LOCAL DATABANKS ---:\n{context}\n"
            )
            
            messages_for_llm = [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": last_msg}
            ]
            
            text = tokenizer.apply_chat_template(messages_for_llm, tokenize=False, add_generation_prompt=True)
            inputs = tokenizer([text], return_tensors="pt", truncation=True, max_length=2048).to(device)
            
            with torch.no_grad():
                outputs = llm_model.generate(**inputs, max_new_tokens=600, temperature=0.3, top_p=0.9, repetition_penalty=1.1)
                
            generated_ids = [output_ids[len(input_ids):] for input_ids, output_ids in zip(inputs.input_ids, outputs)]
            answer = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
            
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
            if rel_path != ".":
                files.append({"name": os.path.basename(root), "type": "directory", "path": rel_path})
            for f in filenames:
                file_path = f if rel_path == "." else os.path.join(rel_path, f)
                files.append({"name": f, "type": "file", "path": file_path})
        return {"files": files[:150]}
    except Exception as e: return {"error": str(e)}

if __name__ == "__main__":
    print("Vey AI Core starting on http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)

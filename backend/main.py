import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000","http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = os.path.join(os.getcwd(), "static")
inner_static = os.path.join(static_dir, "static")

if os.path.exists(inner_static):
    app.mount("/static", StaticFiles(directory=inner_static), name="static")

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    file_path = os.path.join(static_dir, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    return FileResponse(os.path.join(static_dir, "index.html"))
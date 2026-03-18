from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import todos
from app.core.config import settings

app = FastAPI(
    title="Todo API",
    description="A simple todo API with FastAPI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(todos.router, prefix="/api/v1/todos", tags=["todos"])

@app.get("/")
async def root():
    return {"message": "Welcome to Todo API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
"""FastAPI application entry point"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes_ingest, routes_status, routes_search, routes_conflicts, routes_harmonize, routes_generate, routes_policies, routes_issues
from app.jobs import get_all_jobs
from app.config import settings


app = FastAPI(title="SIRA API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(routes_ingest.router)
app.include_router(routes_status.router)
app.include_router(routes_search.router)
app.include_router(routes_policies.router)
app.include_router(routes_conflicts.router)
app.include_router(routes_harmonize.router)
app.include_router(routes_generate.router)
app.include_router(routes_issues.router)


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"ok": True}


@app.on_event("startup")
async def startup_event():
    """Startup event - validate configuration and resume any pending jobs"""
    # Validate embeddings provider configuration
    print(f"[Config] EMBEDDINGS_PROVIDER: {settings.embeddings_provider}")
    
    if settings.embeddings_provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required when EMBEDDINGS_PROVIDER='openai'")
        print("[Config] OpenAI embeddings enabled")
        
        # Test OpenAI client
        from app.openai_client import get_openai_client
        client = get_openai_client()
        if client is None:
            raise ValueError("Failed to initialize OpenAI client. Check OPENAI_API_KEY.")
        print("[Config] OpenAI client initialized successfully")
    elif settings.embeddings_provider == "local":
        print(f"[Config] Local embeddings enabled (model: {settings.embedding_model})")
    else:
        raise ValueError(f"Invalid EMBEDDINGS_PROVIDER: {settings.embeddings_provider}")
    
    # Get all jobs that are QUEUED or PROCESSING
    import asyncio
    from app.jobs import JobStatus, get_all_jobs, start_job_processing
    
    all_jobs = get_all_jobs()
    
    for job in all_jobs:
        if job.get("status") in [JobStatus.QUEUED, JobStatus.PROCESSING]:
            # Resume job processing (non-blocking)
            asyncio.create_task(start_job_processing(job["jobId"]))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

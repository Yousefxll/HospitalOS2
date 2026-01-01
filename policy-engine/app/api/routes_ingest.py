"""Ingestion API routes"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List
import uuid
from app.jobs import create_job, start_job_processing, get_all_jobs
from app.storage import save_uploaded_file, get_file_hash
from app.config import settings
from pathlib import Path


router = APIRouter()


@router.post("/v1/ingest")
async def ingest_files(
    tenantId: str = Form(...),
    uploaderUserId: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    Ingest multiple files
    
    Args:
        tenantId: Tenant identifier (required)
        uploaderUserId: User ID who uploaded (required)
        files: List of files to upload
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    # Check for duplicate filenames before processing
    all_jobs = get_all_jobs(tenantId)
    existing_filenames = set()
    for job in all_jobs:
        filename = job.get("filename")
        if filename:
            existing_filenames.add(filename.lower())  # Case-insensitive comparison
    
    duplicate_files = []
    new_files = []
    
    for file in files:
        filename = file.filename or "unknown"
        if filename.lower() in existing_filenames:
            duplicate_files.append(filename)
        else:
            new_files.append(file)
    
    # If there are duplicates, return error
    if duplicate_files:
        raise HTTPException(
            status_code=409,
            detail=f"File(s) already exist: {', '.join(duplicate_files)}"
        )
    
    jobs = []
    
    for file in new_files:
        # Read file content
        file_content = await file.read()
        
        if len(file_content) == 0:
            continue
        
        # Generate policy ID
        policy_id = str(uuid.uuid4())
        
        # Save file
        file_path = save_uploaded_file(
            tenantId,
            policy_id,
            file.filename or "unknown",
            file_content,
            Path(settings.data_dir)
        )
        
        # Create job
        job_id = create_job(tenantId, policy_id, file.filename or "unknown")
        
        # Start processing in background (non-blocking)
        import asyncio
        asyncio.create_task(start_job_processing(job_id))
        
        jobs.append({
            "jobId": job_id,
            "policyId": policy_id,
            "filename": file.filename or "unknown",
            "status": "QUEUED"
        })
    
    return {
        "tenantId": tenantId,
        "jobs": jobs
    }

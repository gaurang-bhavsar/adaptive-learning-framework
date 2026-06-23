import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import requests

try:
    # Since jobs_store is inside the running process, we can't access it unless we have an endpoint.
    # But wait, does main.py have an endpoint to list jobs? No, only get_job_status(job_id).
    # Let's see if we can check the uvicorn stdout or backend process logs.
    # We can write a test script that directly calls the roadmap generation step-by-step
    # to see where it fails and what the traceback is!
    from backend.services.ai.roadmap_service import RoadmapService
    from backend.services.ai.provider import GeminiProvider
    import asyncio
    
    async def test():
        provider = GeminiProvider()
        service = RoadmapService(provider)
        job_id = service.start_generation_job("django")
        print(f"Started job: {job_id}")
        
        # Poll the job in python and print status
        from backend.services.ai.roadmap_service import jobs_store
        for _ in range(30):
            job = jobs_store.get(job_id)
            if job:
                print(f"Status: {job.status}, Progress: {job.progress_percent}%")
                if job.status in ["ready", "failed"]:
                    if job.graph:
                        print(f"Nodes count: {len(job.graph.nodes)}")
                    break
            await asyncio.sleep(2)
            
    asyncio.run(test())
except Exception as e:
    print(f"Test crashed: {e}")

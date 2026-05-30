from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, catalog, avls, scheduling, incidents, notices

app = FastAPI(title="NCRTC Bus Management System", version="1.0.0")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(avls.router)
app.include_router(scheduling.router)
app.include_router(incidents.router)
app.include_router(notices.router)

@app.get("/")
def root(): return {"ok": True, "docs": "/docs"}

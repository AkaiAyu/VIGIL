from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.detection import router as detection_router
from api.signaling import router as signaling_router
from api.live_detection import router as live_detection_router


app = FastAPI(
    title="VIGIL",
    description="AI-Powered Voice Cloning Detection System",
    version="0.1.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


@app.get("/")
def root():

    return {
        "project": "VIGIL",
        "status": "running",
        "message": "Voice detection backend is online"
    }


app.include_router(
    detection_router,
    prefix="/api"
)


app.include_router(
    signaling_router
)


app.include_router(
    live_detection_router,
    prefix="/api"
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers.upload import router as upload_router
from routers.ask import router as ask_router
from routers.summarize import router as summarize_router
from routers.root import router as root_router
from routers.ask_mongo import router as ask_mongo_router
from routers.convert_frontend import router as convert_frontend_router

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(convert_frontend_router)
app.include_router(ask_router)
app.include_router(summarize_router)
app.include_router(root_router)
app.include_router(ask_mongo_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
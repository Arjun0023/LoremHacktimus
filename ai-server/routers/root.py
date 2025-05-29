from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

@router.get("/")
async def root():
    return JSONResponse(content={"message": "Welcome to the Data Analysis API. Upload a CSV or Excel file and ask questions about your data."})
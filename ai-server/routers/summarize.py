from fastapi import APIRouter, Request, HTTPException
from utility.utils import NpEncoder, get_genai_client
from prompt.summary_prompt import SUMMARY_PROMPT
import json

router = APIRouter()

@router.post("/summarize")
async def summarize_data(request: Request):
    try:
        # Parse the JSON body from the request
        data = await request.json()
        
        # Extract user question and data from the request
        user_question = data.get("question", "")
        input_data = data.get("data", {})
        language = data.get("language", "")
        # Handle empty data
        if not input_data:
            raise HTTPException(status_code=400, detail="No data provided for summarization")
            
        # Convert data to string representation for the model
        data_str = json.dumps(input_data, cls=NpEncoder, indent=2)
        
        # Get Gemini client
        model = get_genai_client()
        
        # Create a combined prompt without using system role
        prompt = SUMMARY_PROMPT.format(
            question=user_question,
            language=language,
            data=data_str
        )
        
        # Call the Gemini model with the combined prompt
        response = model.generate_content(prompt)
        
        # Return the summary
        return {"summary": response.text}
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during summarization: {str(e)}")

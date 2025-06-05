from fastapi import APIRouter, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from utility.utils import get_genai_client
import json
import re
from typing import Any, Dict, List

router = APIRouter()

@router.post("/convert-to-frontend")
async def convert_to_frontend(
    query_result: str = Form(...),
    question: str = Form(...),
    session_id: str = Form(...),
    model = Depends(get_genai_client)
):
    """Convert MongoDB query results to frontend-acceptable format with colors"""
    
    try:
        # Parse the query result if it's a string
        if isinstance(query_result, str):
            try:
                parsed_result = json.loads(query_result)
            except json.JSONDecodeError:
                # If it's not valid JSON, treat it as raw data
                parsed_result = query_result
        else:
            parsed_result = query_result
        
        # Create prompt for converting to frontend format
        conversion_prompt = f"""
Convert the following MongoDB query result into a frontend-acceptable JSON format for data visualization.

Original Question: {question}
Query Result: {json.dumps(parsed_result, indent=2)}

Requirements:
1. Convert the data into an array of objects with this structure:
   {{
       "category": "category_name",
       "value": numeric_value,
       "color": "#hexcolor"
   }}

2. Generate appropriate hex colors for each category (use vibrant, distinct colors)
3. Ensure category names are descriptive and user-friendly
4. Values should be numeric
5. Return ONLY the JSON array, no explanations or additional text
6. If the data contains aggregation results, use the appropriate fields
7. If the data is a list of documents, create meaningful categories and counts

Examples of good colors: #0997d1, #aede39, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57, #ff9ff3, #54a0ff, #5f27cd

Return only the JSON array.
"""
        
        # Generate frontend format
        response = model.generate_content(conversion_prompt, generation_config={
            "temperature": 0.3,
            "top_p": 0.9,
            "max_output_tokens": 2048,
        })
        
        generated_text = response.text.strip()
        
        # Clean the response - remove code blocks if present
        code_pattern = r"```(?:json)?\s*(.*?)\s*```"
        code_match = re.search(code_pattern, generated_text, re.DOTALL | re.IGNORECASE)
        
        if code_match:
            frontend_data = code_match.group(1).strip()
        else:
            frontend_data = generated_text
        
        # Validate that it's proper JSON
        try:
            parsed_frontend_data = json.loads(frontend_data)
            
            # Ensure it's a list
            if not isinstance(parsed_frontend_data, list):
                raise ValueError("Response should be an array")
                
            # Validate structure
            for item in parsed_frontend_data:
                if not isinstance(item, dict):
                    raise ValueError("Each item should be an object")
                if not all(key in item for key in ["category", "value", "color"]):
                    raise ValueError("Each item should have category, value, and color fields")
                    
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate valid frontend format: {str(e)}")
        
        return JSONResponse(
            content={
                "frontend_data": parsed_frontend_data,
                "session_id": session_id,
                "success": True
            },
            media_type="application/json"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error converting to frontend format: {str(e)}")


# Alternative endpoint that takes raw data instead of form data
@router.post("/convert-to-frontend-json")
async def convert_to_frontend_json(
    data: Dict[str, Any],
    model = Depends(get_genai_client)
):
    """Convert MongoDB query results to frontend format - JSON version"""
    
    query_result = data.get("query_result")
    question = data.get("question", "")
    session_id = data.get("session_id", "")
    
    try:
        # Create prompt for converting to frontend format
        conversion_prompt = f"""
Convert the following MongoDB query result into a frontend-acceptable JSON format for data visualization.

Original Question: {question}
Query Result: {json.dumps(query_result, indent=2)}

Requirements:
1. Convert the data into an array of objects with this structure:
   {{
       "category": "category_name",
       "value": numeric_value,
       "color": "#hexcolor"
   }}

2. Generate appropriate hex colors for each category (use vibrant, distinct colors)
3. Ensure category names are descriptive and user-friendly
4. Values should be numeric
5. Return ONLY the JSON array, no explanations or additional text
6. If the data contains aggregation results, use the appropriate fields
7. If the data is a list of documents, create meaningful categories and counts

Examples of good colors: #0997d1, #aede39, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4, #feca57, #ff9ff3, #54a0ff, #5f27cd

Return only the JSON array.
"""
        
        # Generate frontend format
        response = model.generate_content(conversion_prompt, generation_config={
            "temperature": 0.3,
            "top_p": 0.9,
            "max_output_tokens": 2048,
        })
        
        generated_text = response.text.strip()
        
        # Clean the response
        code_pattern = r"```(?:json)?\s*(.*?)\s*```"
        code_match = re.search(code_pattern, generated_text, re.DOTALL | re.IGNORECASE)
        
        if code_match:
            frontend_data = code_match.group(1).strip()
        else:
            frontend_data = generated_text
        
        # Validate JSON
        try:
            parsed_frontend_data = json.loads(frontend_data)
            if not isinstance(parsed_frontend_data, list):
                raise ValueError("Response should be an array")
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate valid frontend format: {str(e)}")
        
        return parsed_frontend_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error converting to frontend format: {str(e)}")
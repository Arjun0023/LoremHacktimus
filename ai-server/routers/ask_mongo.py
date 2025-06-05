from fastapi import APIRouter, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from utility.utils import get_genai_client
import re
from prompt.mongo_prompt import MONGO_PROMPT

router = APIRouter()

@router.post("/ask-mongo")
async def ask_mongo_question(
    question: str = Form(...), 
    session_id: str = Form(...),
    language: str = Form(...),
    context: str = Form(...),
    db_schema: str = Form(...),
    model = Depends(get_genai_client)
):
    """Generate MongoDB query based on user question and database schema"""
    print(f"Received question: {question}")
    original_question = question
    
    # Check if translation is needed
    needs_translation = language.lower() != "en-us"
    
    if needs_translation:
        # Translate question from user's language to English
        translation_prompt = f"Translate the following text from {language} to English. Return ONLY the translated text with no additional explanations: {question}"
        
        try:
            translation_response = model.generate_content(translation_prompt, generation_config={
                "temperature": 0.1,
                "max_output_tokens": 1024,
            })
            
            # Use the translated question for processing
            question = translation_response.text.strip()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Translation error: {str(e)}")
    
    # Construct prompt for MongoDB query generation
    prompt = MONGO_PROMPT.format(
        db_schema=db_schema,
        context=context,
        question=question
    )
    
    try:
        # Generate MongoDB query
        response = model.generate_content(prompt, generation_config={
            "temperature": 0.2,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 4096,
        })
        
        generated_text = response.text.strip()
        
        # Print the raw response for debugging
        print(f"Raw AI response: {generated_text}")
        
        # Extract MongoDB query from code blocks if present, otherwise use the full response
        code_pattern = r"```(?:javascript|js|mongo|mongodb)?\s*(.*?)\s*```"
        code_match = re.search(code_pattern, generated_text, re.DOTALL | re.IGNORECASE)
        
        if code_match:
            mongo_query = code_match.group(1).strip()
            print(f"Extracted from code block: {mongo_query}")
        else:
            # If no code block is found, use the entire response
            mongo_query = generated_text
            print(f"Using full response: {mongo_query}")
        
        # Basic validation - ensure the query is not empty
        if not mongo_query:
            raise HTTPException(status_code=400, detail="Failed to generate a valid MongoDB query")
        
        print(f"Final MongoDB query: {mongo_query}")
        
        return JSONResponse(
            content={
                "query": mongo_query,
                "session_id": session_id,
                "original_question": original_question,
                "translated_question": question if needs_translation else None
            },
            media_type="application/json"
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        error_message = f"Error generating MongoDB query: {str(e)}"
        
        if needs_translation:
            translation_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {error_message}"
            
            try:
                translation_response = model.generate_content(translation_prompt, generation_config={"temperature": 0.1})
                error_message = translation_response.text.strip()
            except Exception:
                # If translation fails, use original error message
                pass
        
        raise HTTPException(status_code=500, detail=error_message)
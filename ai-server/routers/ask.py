from fastapi import APIRouter, Form, Depends, HTTPException
from fastapi.responses import JSONResponse
from utility.utils import sanitize_for_json, validate_code, get_genai_client
from state import uploaded_df, uploaded_file_info
from services.color import add_color_suggestions
import pandas as pd
import numpy as np
import re
from prompt.pandas_prompt import PANDAS_PROMPT
from prompt.codefix_prompt import FIX_CODE_PROMPT

router = APIRouter()

@router.post("/ask")
async def ask_question(
    question: str = Form(...), 
    session_id: str = Form(...),
    language: str = Form(...),
    model = Depends(get_genai_client)
):
    """Ask a question about the uploaded data and get a pandas code snippet as answer"""
    # Check if the DataFrame exists for this session
    if session_id not in uploaded_df:
        raise HTTPException(status_code=404, detail="No file uploaded for this session. Please upload a file first.")
    
    df = uploaded_df[session_id]
    file_info = uploaded_file_info.get(session_id, {})
    
    # Get DataFrame info to provide context to the AI
    df_info = {
        "columns": df.columns.tolist(),
        "dtypes": {col: str(df[col].dtype) for col in df.columns},
        "sample_data": sanitize_for_json(df.head(5).replace({np.nan: None}).to_dict()),
        "original_file_type": file_info.get("original_type", "unknown"),
        "converted_to_csv": file_info.get("converted_to_csv", False)
    }
    
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
    
    # Construct initial prompt for Gemini
    prompt = PANDAS_PROMPT.format(
        columns=df_info['columns'],
        dtypes=df_info['dtypes'],
        sample_data=df.head(5).fillna('NaN').to_string(),
        question=question
    )
    
    try:
        # Generate response
        response = model.generate_content(prompt, generation_config={
            "temperature": 0.2,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        })
        
        generated_text = response.text
        
        # Extract code
        code_pattern = r"```python\s*(.*?)\s*```"
        code_match = re.search(code_pattern, generated_text, re.DOTALL)
        
        if code_match:
            code = code_match.group(1)
        else:
            # If no code block is found, try to extract code directly
            code = generated_text.strip()
            
        # Validate the generated code
        if not validate_code(code):
            error_message = "Generated code contains potentially unsafe operations."
            if needs_translation:
                error_translation_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {error_message}"
                error_translation = model.generate_content(error_translation_prompt, generation_config={"temperature": 0.1})
                error_message = error_translation.text.strip()
            
            return JSONResponse(
                status_code=400,
                content={"error": error_message}
            )
            
        # Create a local copy of the variables to use in exec
        local_vars = {"df": df.copy()}
        
        # Execute the code
        try:
            exec(code, {"pd": pd, "np": np}, local_vars)
            
            # Get the result (assuming the last variable assigned is the result)
            result = None
            for var_name, var_value in local_vars.items():
                if var_name != "df" and isinstance(var_value, (pd.DataFrame, pd.Series)):
                    result = var_value
            
            # If no result variable was found, use the modified df
            if result is None and "df" in local_vars:
                result = local_vars["df"]
                
            # Convert result to JSON-serializable format using the custom encoder
            result_json = None
            if isinstance(result, pd.DataFrame):
                # Replace NaN values first and limit to 50 rows
                result_limited = result.head(50).replace({np.nan: None})
                result_json = sanitize_for_json(result_limited.to_dict(orient='records'))
                result_type = "dataframe"
            elif isinstance(result, pd.Series):
                # Replace NaN values first and limit to 50 entries
                result_limited = result.head(50).replace({np.nan: None})
                result_json = sanitize_for_json(result_limited.to_dict())
                result_type = "series"
            else:
                # Handle other types of results
                try:
                    # Replace any NumPy or pandas values
                    result_json = sanitize_for_json(result)
                except (TypeError, OverflowError):
                    # If result cannot be serialized to JSON, convert to string
                    result_json = str(result)
                result_type = type(result).__name__
                
            # If translation is needed, translate code comments
            if needs_translation:
                # Extract comments from the code
                comment_pattern = r"#(.+?)(?=\n|$)"
                comments = re.findall(comment_pattern, code)
                
                if comments:
                    comments_text = "\n".join(comments)
                    translation_prompt = f"Translate the following Python code comments from English to {language}. Return ONLY the translated comments, one per line, with no additional explanations:\n\n{comments_text}"
                    
                    try:
                        translation_response = model.generate_content(translation_prompt, generation_config={
                            "temperature": 0.1,
                            "max_output_tokens": 2048,
                        })
                        
                        translated_comments = translation_response.text.strip().split("\n")
                        
                        # Replace comments in the code
                        for i, original_comment in enumerate(comments):
                            if i < len(translated_comments):
                                code = code.replace(
                                    f"#{original_comment}", 
                                    f"#{translated_comments[i]}"
                                )
                    except Exception as e:
                        # If translation fails, keep original comments
                        pass
            
            response_data = {
                "code": code,
                "result": result_json,
                "result_type": result_type,
                "file_info": {
                    "original_filename": file_info.get("original_filename", "unknown"),
                    "converted_from_excel": file_info.get("converted_to_csv", False)
                }
            }
            if response_data.get('result') and isinstance(response_data['result'], list):
                try:
                    # Use a separate model instance for color suggestion if possible
                    color_model = get_genai_client()  # or use a different method to get a Gemini Flash Lite client
                    
                    response_data['result'] = await add_color_suggestions(
                        response_data['result'], 
                        color_model
                    )
                except Exception as color_error:
                    # Log the color suggestion error but don't block the main response
                    print(f"Color suggestion failed: {color_error}")
            
            return JSONResponse(content=response_data, media_type="application/json")
            
        except Exception as e:
            # When execution error occurs, send error back to Gemini to fix it
            error_str = str(e)
            fix_prompt = FIX_CODE_PROMPT.format(
                question=question,
                columns=df_info['columns'],
                sample_data=df.head(5).fillna('NaN').to_string(),
                code=code,
                error_str=error_str
            )
            
            try:
                # Generate fixed code
                fix_response = model.generate_content(fix_prompt, generation_config={
                    "temperature": 0.2,
                    "top_p": 0.95,
                    "top_k": 40,
                    "max_output_tokens": 8192,
                })
                
                fixed_text = fix_response.text
                
                # Extract code from the fixed response
                fixed_code_match = re.search(code_pattern, fixed_text, re.DOTALL)
                
                if fixed_code_match:
                    fixed_code = fixed_code_match.group(1)
                else:
                    # If no code block is found, try to extract code directly
                    fixed_code = fixed_text.strip()
                
                # Validate the fixed code
                if not validate_code(fixed_code):
                    error_message = "Generated code contains potentially unsafe operations."
                    original_error = error_str
                    
                    if needs_translation:
                        error_translation_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {error_message}"
                        original_error_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {original_error}"
                        
                        try:
                            error_translation = model.generate_content(error_translation_prompt, generation_config={"temperature": 0.1})
                            original_error_translation = model.generate_content(original_error_prompt, generation_config={"temperature": 0.1})
                            
                            error_message = error_translation.text.strip()
                            original_error = original_error_translation.text.strip()
                        except Exception:
                            # If translation fails, use original error messages
                            pass
                    
                    return JSONResponse(
                        status_code=400,
                        content={
                            "error": error_message,
                            "original_error": original_error,
                            "original_code": code,
                            "fixed_code": fixed_code
                        }
                    )
                
                # Try executing the fixed code
                local_vars = {"df": df.copy()}
                exec(fixed_code, {"pd": pd, "np": np}, local_vars)
                
                # Get the result from the fixed code
                result = None
                for var_name, var_value in local_vars.items():
                    if var_name != "df" and isinstance(var_value, (pd.DataFrame, pd.Series)):
                        result = var_value
                
                # If no result variable was found, use the modified df
                if result is None and "df" in local_vars:
                    result = local_vars["df"]
                    
                # Convert result to JSON-serializable format
                result_json = None
                if isinstance(result, pd.DataFrame):
                    result_limited = result.head(50).replace({np.nan: None})
                    result_json = sanitize_for_json(result_limited.to_dict(orient='records'))
                    result_type = "dataframe"
                elif isinstance(result, pd.Series):
                    result_limited = result.head(50).replace({np.nan: None})
                    result_json = sanitize_for_json(result_limited.to_dict())
                    result_type = "series"
                else:
                    try:
                        result_json = sanitize_for_json(result)
                    except (TypeError, OverflowError):
                        result_json = str(result)
                    result_type = type(result).__name__
                
                # Translate fixed code comments if needed
                if needs_translation:
                    # Extract comments from the fixed code
                    comment_pattern = r"#(.+?)(?=\n|$)"
                    comments = re.findall(comment_pattern, fixed_code)
                    
                    if comments:
                        comments_text = "\n".join(comments)
                        translation_prompt = f"Translate the following Python code comments from English to {language}. Return ONLY the translated comments, one per line, with no additional explanations:\n\n{comments_text}"
                        
                        try:
                            translation_response = model.generate_content(translation_prompt, generation_config={
                                "temperature": 0.1,
                                "max_output_tokens": 2048,
                            })
                            
                            translated_comments = translation_response.text.strip().split("\n")
                            
                            # Replace comments in the code
                            for i, original_comment in enumerate(comments):
                                if i < len(translated_comments):
                                    fixed_code = fixed_code.replace(
                                        f"#{original_comment}", 
                                        f"#{translated_comments[i]}"
                                    )
                        except Exception:
                            # If translation fails, keep original comments
                            pass
                
                # Translate error message if needed
                original_error = error_str
                if needs_translation:
                    error_translation_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {error_str}"
                    try:
                        error_translation = model.generate_content(error_translation_prompt, generation_config={"temperature": 0.1})
                        original_error = error_translation.text.strip()
                    except Exception:
                        # If translation fails, use original error message
                        pass
                
                # Return the fixed code and result
                response_data = {
                    "code": fixed_code,
                    "result": result_json,
                    "result_type": result_type,
                    "file_info": {
                        "original_filename": file_info.get("original_filename", "unknown"),
                        "converted_from_excel": file_info.get("converted_to_csv", False)
                    },
                    "error_fixed": True,
                    "original_error": original_error
                }
                
                return JSONResponse(content=response_data, media_type="application/json")
                
            except Exception as fix_error:
                # If fixing also fails, return both the original error and the fixing error
                original_error = error_str
                fixing_error = str(fix_error)
                
                if needs_translation:
                    original_error_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {error_str}"
                    fixing_error_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {fixing_error}"
                    
                    try:
                        original_error_translation = model.generate_content(original_error_prompt, generation_config={"temperature": 0.1})
                        fixing_error_translation = model.generate_content(fixing_error_prompt, generation_config={"temperature": 0.1})
                        
                        original_error = original_error_translation.text.strip()
                        fixing_error = fixing_error_translation.text.strip()
                    except Exception:
                        # If translation fails, use original error messages
                        pass
                
                error_message = f"Original error: {original_error}\nError fixing code: {fixing_error}"
                
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": error_message,
                        "original_code": code,
                        "fixing_attempt_failed": True
                    }
                )
    
    except Exception as e:
        error_message = f"Error generating or executing code: {str(e)}"
        
        if needs_translation:
            translation_prompt = f"Translate the following text from English to {language}. Return ONLY the translated text with no additional explanations: {error_message}"
            
            try:
                translation_response = model.generate_content(translation_prompt, generation_config={"temperature": 0.1})
                error_message = translation_response.text.strip()
            except Exception:
                # If translation fails, use original error message
                pass
        
        raise HTTPException(status_code=500, detail=error_message)
    

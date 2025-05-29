from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import pandas as pd
import numpy as np
import io
from utility.utils import sanitize_for_json
from state import uploaded_df, uploaded_file_info
from services.insights import generate_insights_from_gemini

router = APIRouter()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(...)):
    """Upload Excel or CSV file, convert Excel to CSV if needed, store as a pandas DataFrame and generate insights"""
    if file.filename.endswith(('.csv', '.xlsx', '.xls')):
        contents = await file.read()
        
        try:
            # Store original file info
            original_filename = file.filename
            original_file_type = "csv" if file.filename.endswith('.csv') else "excel"
            encoding_used = "utf-8"  # Default encoding
            
            # Convert to pandas dataframe based on file type
            if file.filename.endswith('.csv'):
                # Try reading with different encodings if UTF-8 fails
                try:
                    df = pd.read_csv(io.BytesIO(contents))
                except UnicodeDecodeError:
                    # Try with different encodings
                    encodings = ['latin-1', 'iso-8859-1', 'windows-1252', 'cp1252']
                    for encoding in encodings:
                        try:
                            df = pd.read_csv(io.BytesIO(contents), encoding=encoding)
                            encoding_used = encoding
                            break
                        except Exception:
                            continue
                    else:
                        raise HTTPException(status_code=400, 
                            detail="Unable to decode CSV file. Please try saving it with UTF-8 encoding.")
            else:  # Excel file
                try:
                    excel_df = pd.read_excel(io.BytesIO(contents))
                    
                    # Convert Excel DataFrame to CSV format (in memory)
                    csv_buffer = io.StringIO()
                    excel_df.to_csv(csv_buffer, index=False)
                    csv_buffer.seek(0)
                    
                    # Read back the CSV data
                    df = pd.read_csv(csv_buffer)
                except Exception as excel_error:
                    raise HTTPException(status_code=400, 
                        detail=f"Error processing Excel file: {str(excel_error)}")
            
            # Store the dataframe and file info with the session ID
            uploaded_df[session_id] = df
            uploaded_file_info[session_id] = {
                "original_filename": original_filename,
                "original_type": original_file_type,
                "converted_to_csv": original_file_type == "excel",
                "encoding": encoding_used
            }
            
            # Get column information
            columns = df.columns.tolist()
            
            # Get the first 10 rows for preview
            sample_data = df.head(20).replace({np.nan: None})
            # Ensure all data is properly sanitized for JSON
            sample_data_dict = sanitize_for_json(sample_data.to_dict(orient='records'))
            
            # Generate insights using Gemini
            insights = await generate_insights_from_gemini(df)
            
            conversion_message = ""
            if original_file_type == "excel":
                conversion_message = " Excel file was converted to CSV format for processing."
            elif encoding_used != "utf-8":
                conversion_message = f" File was read using {encoding_used} encoding."
            
            # Return sanitized data using JSONResponse with the custom encoder
            response_data = {
                "filename": original_filename,
                "columns": columns,
                "num_rows_total": len(df),
                "first_10_rows": sample_data_dict,
                "converted_to_csv": original_file_type == "excel",
                "encoding_used": encoding_used,
                "insights": insights,
                "message": f"File uploaded successfully.{conversion_message} You can now ask questions about your data."
            }
            
            return JSONResponse(content=response_data, media_type="application/json")
            
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")




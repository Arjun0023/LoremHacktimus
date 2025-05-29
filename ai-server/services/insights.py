import os
import io
import json
import google.generativeai as genai
from prompt.gemini_insight_prompt import GEMINI_INSIGHT_PROMPT, GEMINI_INSIGHT_EXAMPLE_RESPONSE


async def generate_insights_from_gemini(df):
    """Generate insights from Gemini based on the dataframe"""
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
    data_sample = df.head(100)
    csv_buffer = io.StringIO()
    data_sample.to_csv(csv_buffer, index=False)
    csv_text = csv_buffer.getvalue()
    model = genai.GenerativeModel('gemini-2.0-flash')
    columns = df.columns.tolist()
    system_instruction = GEMINI_INSIGHT_PROMPT
    example_response = GEMINI_INSIGHT_EXAMPLE_RESPONSE
    column_info = "Dataset columns: " + ", ".join(columns)
    prompt = f"{system_instruction}\n\n{column_info}\n\nExample output format:\n{example_response}\n\nData to analyze:\n{csv_text}\n\nGenerate 4 simple, business-focused questions for this dataset."
    generation_config = {
        "temperature": 1,
        "top_p": 0.95,
        "top_k": 40,
        "max_output_tokens": 8192,
        "response_mime_type": "application/json"
    }
    try:
        response = model.generate_content(
            prompt,
            generation_config=generation_config
        )
        try:
            if hasattr(response, 'text'):
                return json.loads(response.text)
            else:
                if hasattr(response, 'parts'):
                    response_text = response.parts[0].text
                    return json.loads(response_text)
                elif hasattr(response, 'candidates') and len(response.candidates) > 0:
                    content = response.candidates[0].content
                    if hasattr(content, 'parts') and len(content.parts) > 0:
                        response_text = content.parts[0].text
                        return json.loads(response_text)
        except (json.JSONDecodeError, AttributeError) as e:
            print(f"Error parsing response: {str(e)}")
            if hasattr(response, 'text'):
                raw_text = response.text
            elif hasattr(response, 'parts'):
                raw_text = response.parts[0].text
            else:
                raw_text = str(response)
            try:
                start_idx = raw_text.find("{")
                end_idx = raw_text.rfind("}")
                if start_idx >= 0 and end_idx > start_idx:
                    json_str = raw_text[start_idx:end_idx+1]
                    return json.loads(json_str)
            except:
                pass
            return {"question": ["Could not parse response properly.", 
                              "Please check the data format.",
                              "Consider using a different prompt.",
                              "Raw response may contain insights but in wrong format."]}
    except Exception as e:
        print(f"Error generating insights: {str(e)}")
        return {"question": ["Could not generate insights from the data.",
                          "Error connecting to Gemini API.",
                          "Please check your API key and network connection.",
                          "Try with a smaller dataset sample."]}
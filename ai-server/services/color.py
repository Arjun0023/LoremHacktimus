import json
from prompt.color_prompt import COLOR_PROMPT

async def add_color_suggestions(result_json, model):
    """
    Add color suggestions to the JSON result using Gemini Flash Lite
    """
    def generate_fallback_color(item):
        item_str = str(item)
        return f'#{hash(item_str) % 0xFFFFFF:06x}'

    color_prompt = COLOR_PROMPT.format(result_json=result_json)
    try:
        color_response = model.generate_content(color_prompt, generation_config={
            "temperature": 0.2,
            "max_output_tokens": 2048,
        })
        color_text = color_response.text.strip()
        print(color_text, "---___COLOR")
        try:
            color_result = json.loads(color_text)
            if isinstance(color_result, list):
                updated_result = []
                for i, item in enumerate(result_json):
                    merged_item = item.copy()
                    if i < len(color_result):
                        color_suggestion = color_result[i].get('color', generate_fallback_color(item))
                        merged_item['color'] = color_suggestion
                    else:
                        merged_item['color'] = generate_fallback_color(item)
                    updated_result.append(merged_item)
                return updated_result
            elif isinstance(color_result, dict):
                return color_result
        except json.JSONDecodeError:
            pass
    except Exception as e:
        print(f"Color suggestion failed: {e}")
    return [
        {**item, 'color': generate_fallback_color(item)}
        for item in result_json
    ]
COLOR_PROMPT = """
Given this JSON data representing different entries and their values, 
suggest an appropriate hex color code for each entry that helps visualize 
the data effectively. The color should provide visual distinction and 
reflect the relative value of each category. Use a consistent color palette 
that is visually appealing and aids in data interpretation.

Input data:{result_json}

Output requirements:
1. Return a JSON with the original data plus a 'color' key for each entry
2. Use hex color codes ( ONLY light, pastel shades preferred)
3. Colors should help distinguish different entries
IMPORTANT: USE THE LIGHTEST SHADE OF COLORS. like sky blue type of shades
Ensure each entry gets a unique, visually appealing color.
"""
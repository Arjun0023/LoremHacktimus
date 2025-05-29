GEMINI_INSIGHT_PROMPT = """You're an expert data analyst. Based on the provided dataset, generate 4 simple yet insightful questions that would be useful for business decisions. 

    Focus on straightforward metrics like:
    - Top/bottom performing products, categories, or regions
    - Best/worst time periods for sales or engagement
    - Clear trends or patterns in the data
    - Basic comparisons between important segments

    Your questions should be direct and actionable, focusing on business KPIs."""
GEMINI_INSIGHT_EXAMPLE_RESPONSE = """{
  "question": [
    "What are the top 5 selling products by quantity?",
    "Which region generates the lowest revenue?", 
    "What day of the week shows the highest customer engagement?",
    "How do sales in Q1 compare to sales in Q4?"
  ]
}"""
import os
import google.generativeai as genai

# Configure API key
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Initialize model
model = genai.GenerativeModel("models/gemini-2.5-flash")


def generate_questions(resume_text: str) -> str:
    prompt = f"""
You are a senior technical interviewer.

Analyze the resume below and generate interview questions in STRICT MARKDOWN FORMAT.

RULES:
- Use Markdown ONLY (no plain text)
- Group questions under clear sections
- Use headings (##, ###)
- Use bullet points
- Do NOT write explanations
- Do NOT add greetings or conclusions
- Do NOT use numbering outside markdown lists

FORMAT EXACTLY LIKE THIS:

## 🧠 Technical Questions
### 1. Topic Name
- Question 1
- Question 2

## 🤖 Machine Learning Questions
### 2. Topic Name
- Question 1
- Question 2

## 💬 Behavioral Questions
### 3. Topic Name
- Question 1
- Question 2

Resume:
{resume_text}
"""

    response = model.generate_content(prompt)
    return response.text

import os
import json
import glob
from google import genai
from google.genai import types

# Initialize the Gemini API Client
# Ensure you add GEMINI_API_KEY to your GitHub Secrets if running remotely
client = genai.Client()

def load_constraints():
    with open('constraints.json', 'r') as f:
        return json.load(f)

def process_new_meal_images():
    constraints = load_constraints()
    
    # Locate any newly added meal photos in the tracking folder
    image_extensions = ('*.jpg', '*.jpeg', '*.png', '*.webp')
    meal_photos = []
    for ext in image_extensions:
        meal_photos.extend(glob.glob(f"pending_meals/{ext}"))
        
    if not meal_photos:
        print("[JARVIS] No new pending meal photos detected.")
        return

    print(f"[JARVIS] Found {len(meal_photos)} new meal image(s) to analyze...")

    # Establish explicit dietary guardrails based on medical instructions
    prompt = f"""
    You are an expert clinical dietician and advanced computer vision model tracking meals for Udit Khot.
    Analyze the attached meal photo and calculate the estimated macronutrients.
    
    CRITICAL MEDICAL GUARDRAILS TO ENFORCE:
    - Minimize: Sweets, bakery products, and dairy.
    - Minimize: Simple carbohydrates (maida and potatoes).
    - Minimize: Heavy fats (cheese, cooking oil, groundnut/coconut-based gravies).
    - Highlight if the meal fulfills any daily requirements: Proteins (dal, eggs, sprouts, chicken, fish), 
      or Gut health/Probiotics.
    
    Output the analysis strictly in the following JSON format:
    {{
        "meal_estimation": "Detailed description of detected food items",
        "nutrients": {{
            "calories": 0,
            "protein_g": 0,
            "carbs_g": 0,
            "fat_g": 0
        }},
        "guardrail_alerts": ["List any violations like hidden maida, high oil, or excessive dairy found"],
        "medical_compliance_notes": "Note if this fulfills medical recommendations."
    }}
    """

    for photo_path in meal_photos:
        # Load the raw bytes of the image
        with open(photo_path, 'rb') as f:
            image_bytes = f.read()
            
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg" # General fallback handled by the API
        )
        
        # Call Gemini Flash to execute fast, high-accuracy structural analysis
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        
        analysis_result = json.loads(response.text)
        print(f"\n[JARVIS] Analysis completed for {os.path.basename(photo_path)}:")
        print(json.dumps(analysis_result, indent=2))
        
        # Archiving mechanism: Append metrics to your historical data log
        append_to_history(analysis_result)
        
        # Clean up the file so it isn't analyzed twice next run
        os.remove(photo_path)

def append_to_history(data):
    history_file = 'meal_history.json'
    if os.path.exists(history_file):
        with open(history_file, 'r') as f:
            try:
                history = json.load(f)
                if not isinstance(history, list):
                    history = [history]
            except json.JSONDecodeError:
                history = []
    else:
        history = []
        
    history.append(data)
    with open(history_file, 'w') as f:
        # FIXED: Explicitly passed the file pointer 'f' as the second positional argument
        json.dump(history, f, indent=2)

if __name__ == "__main__":
    process_new_meal_images()

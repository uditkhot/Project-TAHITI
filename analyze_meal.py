import os
import json
import glob
from google import genai
from google.genai import types

# Initialize the Gemini Client with strict network boundaries
client = genai.Client(
    http_options=types.HttpOptions(
        timeout=30 * 1000,
        retry_options=types.HttpRetryOptions(attempts=3)
    )
)

def load_constraints():
    with open('constraints.json', 'r') as f:
        return json.load(f)

def process_new_meal_images():
    os.makedirs("pending_meals", exist_ok=True)
    
    # Catch all variation extensions
    valid_extensions = ('*.jpg', '*.jpeg', '*.png', '*.webp', '*.JPG', '*.JPEG', '*.PNG')
    meal_photos = []
    for ext in valid_extensions:
        meal_photos.extend(glob.glob(f"pending_meals/{ext}"))
        
    if not meal_photos:
        print("[JARVIS] Clean queue: No new meal snapshots detected for processing.")
        return

    print(f"[JARVIS] Scanning {len(meal_photos)} file asset(s) in queue...")

    prompt = """
    You are Udit Khot's dedicated clinical dietician vision model.
    Analyze this meal snapshot and calculate the estimated macronutrients.
    
    MEDICAL RULES TO ENFORCE:
    - Exclude or minimize: Maida, bakery items, potatoes, heavy cheese, and high cooking oil.
    - Track compliance with mandatory daily protein and gut health rotations.
    
    Output JSON ONLY in this format:
    {
        "meal_estimation": "Name/description of food",
        "nutrients": {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0},
        "guardrail_alerts": [],
        "medical_compliance_notes": "Compliance report summary"
    }
    """

    for photo_path in meal_photos:
        filename = os.path.basename(photo_path)
        
        # Guardrail 1: Skip Git placeholder files instantly
        if filename.startswith('.'):
            continue

        try:
            with open(photo_path, 'rb') as f:
                image_bytes = f.read()
            
            # Guardrail 2: Catch Git LFS text pointers masquerading as binary images
            if b"version https://git-lfs" in image_bytes[:100]:
                print(f"[JARVIS] File reference error: {filename} is a metadata pointer, not raw pixels. Skipping parsing sequence.")
                os.remove(photo_path)
                continue

            print(f"[JARVIS] Sending binary payload to Gemini Vision Engine: {filename}")
            
            image_part = types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/jpeg"
            )
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            
            analysis_result = json.loads(response.text)
            print(f"[JARVIS] Successfully analyzed and classified {filename}.")
            append_to_history(analysis_result)
            
        except Exception as e:
            # System Isolation: Log the specific error message to console but DO NOT let it halt execution
            print(f"[JARVIS] Architectural Exception caught during vision compilation for {filename}: {e}")
            print("[JARVIS] Gracefully bypassing asset to keep the core task delivery script alive.")
            
        finally:
            # Ensure the queue lane is wiped clear to prevent infinite loops on the next run
            if os.path.exists(photo_path):
                os.remove(photo_path)

def append_to_history(data):
    history_file = 'meal_history.json'
    history = []
    
    if os.path.exists(history_file):
        with open(history_file, 'r') as f:
            try:
                history = json.load(f)
                if not isinstance(history, list):
                    history = [history]
            except json.JSONDecodeError:
                history = []
                
    history.append(data)
    with open(history_file, 'w') as f:
        json.dump(history, f, indent=2)

if __name__ == "__main__":
    process_new_meal_images()

import os
import json
import re
import requests
from google import genai
from google.genai import types

# Automatically generated context parameters provided securely by the Actions environment
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
REPO = os.environ.get("GITHUB_REPOSITORY") 

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def process_github_issues_as_meals():
    if not GITHUB_TOKEN or not REPO:
        print("[JARVIS] Structural Error: System running without valid GitHub context keys.")
        return

    # 1. Fetch all open issues inside your Project-TAHITI repository
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    url = f"https://api.github.com/repos/{REPO}/issues?state=open"
    issues = requests.get(url, headers=headers).json()

    if not issues or not isinstance(issues, list):
        print("[JARVIS] Clean environment checklist: No active intake tracking issues open.")
        return

    print(f"[JARVIS] Found {len(issues)} open logging issues to process...")

    prompt_template = """
    You are Udit Khot's dedicated clinical dietician vision model.
    Analyze this meal snapshot and calculate the estimated macronutrients.
    
    CULINARY OVERRIDE NOTE:
    The user has titled this log entry: "{issue_title}". Use this textual string to anchor your classification.
    Look closely at the texture to differentiate irregular egg folds from pancake mixes.
    
    MEDICAL RULES TO ENFORCE:
    - Exclude or minimize: Maida, bakery items, potatoes, heavy cheese, and high cooking oil.
    - Track compliance with mandatory daily protein and gut health rotations.
    
    Output JSON ONLY in this format:
    {{
        "meal_estimation": "{issue_title}",
        "nutrients": {{"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0}},
        "guardrail_alerts": [],
        "medical_compliance_notes": "Compliance report summary"
    }}
    """

    for issue in issues:
        issue_id = issue["number"]
        title = issue["title"].strip()
        body = issue.get("body", "") or ""

        # Check if the title is a quick Pantry text string update instead of a meal photo
        if title.lower().startswith("pantry:") or title.lower().startswith("out of"):
            print(f"[JARVIS] Overwriting grocery tracking profile text from Issue #{issue_id}...")
            with open("inventory_note.txt", "w") as f:
                f.write(title + "\n" + body)
                
            # Close the text tracking issue cleanly
            close_url = f"https://api.github.com/repos/{REPO}/issues/{issue_id}"
            requests.patch(close_url, headers=headers, json={"state": "closed", "labels": ["pantry-updated-by-jarvis"]})
            continue

        # Extract markdown image addresses generated natively by the GitHub Android Application
        img_match = re.search(r'\!\[.*?\]\((https://github\.com/.*?)\)', body)
        
        if not img_match:
            print(f"[JARVIS] Issue #{issue_id} ({title}) does not contain binary media attachments. Skipping processing.")
            continue

        img_url = img_match.group(1)
        print(f"[JARVIS] Downloading raw binary image data stream from GitHub Asset Storage for: {title}")
        img_bytes = requests.get(img_url, headers=headers).content

        try:
            image_part = types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[image_part, prompt_template.format(issue_title=title)],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            
            analysis_result = json.loads(response.text)
            print(f"[JARVIS] Classification complete for Issue #{issue_id}.")
            append_to_history(analysis_result)
            
            # Close the tracking issue to keep the board empty and clean
            close_url = f"https://api.github.com/repos/{REPO}/issues/{issue_id}"
            requests.patch(close_url, headers=headers, json={"state": "closed", "labels": ["processed-by-jarvis"]})
            
        except Exception as e:
            print(f"[JARVIS] Critical bypass execution on Issue #{issue_id}: {e}")

def append_to_history(data):
    history_file = 'meal_history.json'
    history = []
    if os.path.exists(history_file):
        with open(history_file, 'r') as f:
            try: history = json.load(f)
            except: history = []
    history.append(data)
    with open(history_file, 'w') as f:
        json.dump(history, f, indent=2)

if __name__ == "__main__":
    process_github_issues_as_meals()
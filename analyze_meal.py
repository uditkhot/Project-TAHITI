import os
import json
import re
import requests
from google import genai
from google.genai import types

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
REPO = os.environ.get("GITHUB_REPOSITORY") 

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def download_github_asset(url, headers):
    """
    Downloads an issue image asset safely by stripping out authorization 
    headers if GitHub redirects the download request to an AWS S3 bucket.
    """
    session = requests.Session()
    
    # Define a custom hook to intercept and clean headers on redirect
    def clear_auth_on_redirect(response, **kwargs):
        if response.is_redirect or response.status_code in [301, 302, 307, 308]:
            redirect_url = response.headers.get('Location')
            # If redirected away from github.com (e.g., to AWS S3), drop the token
            if "github.com" not in redirect_url:
                session.headers.pop("Authorization", None)
                
    session.hooks['response'].append(clear_auth_on_redirect)
    session.headers.update(headers)
    
    # Execute file stream retrieval
    res = session.get(url, allow_redirects=True)
    return res.content

def process_github_issues_as_meals():
    if not GITHUB_TOKEN or not REPO:
        print("[JARVIS] Structural Error: System running without valid GitHub context keys.")
        return

    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    url = f"https://api.github.com/repos/{REPO}/issues?state=open"
    issues = requests.get(url, headers=headers).json()

    if not issues or not isinstance(issues, list):
        print("[JARVIS] Clean environment checklist: No active intake tracking issues open.")
        return

    print(f"[JARVIS] Scanning {len(issues)} open intake track issues...")

    prompt_template = """
    You are Udit Khot's dedicated clinical dietician vision model.
    Analyze this meal snapshot and calculate the estimated macronutrients.
    
    CULINARY OVERRIDE NOTE:
    The user has titled this log entry: "{issue_title}". Use this text identifier to anchor your classification.
    
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

        # Process Pantry string text overrides
        if title.lower().startswith("pantry:") or title.lower().startswith("out of"):
            print(f"[JARVIS] Extracting grocery note data from Issue #{issue_id}...")
            with open("inventory_note.txt", "w") as f:
                f.write(title + "\n" + body)
                
            close_url = f"https://api.github.com/repos/{REPO}/issues/{issue_id}"
            requests.patch(close_url, headers=headers, json={"state": "closed", "labels": ["pantry-updated-by-jarvis"]})
            continue

        # Extract markdown image links
        img_match = re.search(r'\!\[.*?\]\((https://github\.com/.*?)\)', body)
        
        if not img_match:
            print(f"[JARVIS] Issue #{issue_id} ({title}) does not contain a valid image attachment. Skipping.")
            continue

        img_url = img_match.group(1)
        print(f"[JARVIS] Handshaking secure download for asset link: {title}")
        
        # Use our fortified redirection-safe downloading asset worker
        img_bytes = download_github_asset(img_url, headers)

        try:
            image_part = types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[image_part, prompt_template.format(issue_title=title)],
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            
            analysis_result = json.loads(response.text)
            print(f"[JARVIS] Analysis finalized for Issue #{issue_id}.")
            append_to_history(analysis_result)
            
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

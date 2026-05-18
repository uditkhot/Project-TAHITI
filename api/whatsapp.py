import os
import json
import base64
import requests
from flask import Flask, request

app = Flask(__name__)

# System Configurations pulled from secure cloud variables
GITHUB_TOKEN = os.environ.get("PERSONAL_ACCESS_TOKEN")
REPO = os.environ.get("GITHUB_REPOSITORY") # Format: "uditkhot/Project-TAHITI"

def commit_to_github(path, commit_message, content_bytes, is_text=False):
    """Programmatically forces files into your private repository via API"""
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    # Check if the file already exists to obtain its SHA hash modifier
    resp = requests.get(url, headers=headers)
    sha = resp.json().get("sha") if resp.status_code == 200 else None
    
    # Encode contents to standard base64 strings for transmission transfer
    encoded = base64.b64encode(content_bytes).decode("utf-8") if not is_text else base64.b64encode(content_bytes.encode("utf-8")).decode("utf-8")
    
    payload = {
        "message": commit_message,
        "content": encoded,
        "branch": "main"
    }
    if sha:
        payload["sha"] = sha
        
    requests.put(url, headers=headers, json=payload)

@app.route("/api/whatsapp", methods=['POST'])
def handle_whatsapp_payload():
    # 1. Intercept messaging context vectors from Twilio
    incoming_msg = request.values.get('Body', '').strip()
    num_media = int(request.values.get('NumMedia', 0))
    
    # 2. Case A: User sent a Meal Snapshot photo
    if num_media > 0:
        media_url = request.values.get('MediaUrl0')
        content_type = request.values.get('MediaContentType0')
        
        # Isolate true file extensions safely
        ext = "png" if "png" in content_type else "jpg"
        timestamp = int(requests.utils.time.time())
        filename = f"pending_meals/meal_{timestamp}.{ext}"
        
        # Download image stream from secure Twilio servers
        img_bytes = requests.get(media_url).content
        
        # Push image straight into your repository's landing queue directory
        commit_to_github(filename, f"JARVIS: Ingested WhatsApp snapshot [meal_{timestamp}]", img_bytes)
        
        # Optional: If you included a text caption along with the photo, save it as an anchor name
        if incoming_msg:
            commit_to_github(f"pending_meals/meal_{timestamp}.txt", "JARVIS: Appended photo naming text context", incoming_msg, is_text=True)
            
        return f"<Response><Message>Snapshot localized successfully, sir. Log entry saved as meal_{timestamp}.{ext}.</Message></Response>"
    
    # 3. Case B: User sent a Grocery Inventory Update
    if incoming_msg.lower().startswith("pantry:") or incoming_msg.lower().startswith("out of"):
        commit_to_github("inventory_note.txt", "JARVIS: Manual pantry matrix override via WhatsApp text", incoming_msg, is_text=True)
        return "<Response><Message>Pantry log registers updated. Adjusting tomorrow's health parameters.</Message></Response>"
        
    return "<Response><Message>System alert: Command parameters out of bounds. Please drop a meal snapshot photo or prefix grocery text logs with 'Pantry:'.</Message></Response>"

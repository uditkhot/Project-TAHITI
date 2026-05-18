import os
import json
import datetime
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Initialize the Gemini Client with native HTTP resilience configurations
ai_client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
    http_options=types.HttpOptions(
        # Set a 60-second total socket timeout patience threshold
        timeout=60 * 1000, 
        # Inject standard network fault tolerance logic directly into the SDK
        retry_options=types.HttpRetryOptions(
            attempts=5,                  # Try up to 5 times before throwing a crash error
            initial_delay=2.0,            # Wait 2 seconds on the first server drop
            exp_base=2.0,                 # Exponential backoff factor (2s, 4s, 8s, 16s...)
            max_delay=30.0,               # Maximum ceiling delay limit between attempts
            http_status_codes=[408, 429, 500, 502, 503, 504] # Catch transient errors cleanly
        )
    )
)

def get_tasks_service():
    creds_json = os.environ.get("GOOGLE_TASKS_TOKEN")
    creds_data = json.loads(creds_json)
    creds = Credentials.from_authorized_user_info(creds_data)
    return build('tasks', 'v1', credentials=creds)

def get_or_create_list(service, name):
    lists = service.tasklists().list().execute()
    for l in lists.get('items', []):
        if l['title'] == name:
            return l['id']
    new_list = service.tasklists().insert(body={"title": name}).execute()
    return new_list['id']

def task_exists(service, list_id, title, due_date):
    tasks = service.tasks().list(tasklist=list_id, dueMin=due_date+"T00:00:00Z", dueMax=due_date+"T23:59:59Z").execute()
    for t in tasks.get('items', []):
        if t['title'] == title:
            return True, t['id']
    return False, None

def create_subtask(service, list_id, parent_id, title, notes=None):
    today = datetime.date.today().isoformat() + "T00:00:00Z"
    body = {"title": title, "parent": parent_id, "due": today}
    if notes:
        body["notes"] = notes
    return service.tasks().insert(tasklist=list_id, body=body).execute()

def fetch_health_context():
    with open('constraints.json', 'r') as f:
        constraints = json.load(f)
    if os.path.exists('meal_history.json'):
        with open('meal_history.json', 'r') as f:
            history = json.load(f)[-5:]
    else:
        history = ["No previous logs recorded yet. This is Day 1."]
    return constraints, history

def ask_gemini_to_build_day(constraints, history):
    prompt = f"""
    You are Udit Khot's dedicated AI health engineer. 
    Analyze his medical/dietary constraints and his recent history logs to generate a hyper-personalized, 100% dynamic daily routine for today: {datetime.date.today()}.
    
    CORE CLIENT PROFILE & MEDICAL PARAMETERS:
    {json.dumps(constraints, indent=2)}
    
    RECENT HISTORICAL LOGS:
    {json.dumps(history, indent=2)}
    
    ENGINEERING REQUIREMENTS FOR OUTPUT:
    1. Force proper variation into exercises using his home 5kg dumbbells or society gym.
    2. Ensure daily nutritional rotations from his medical guidelines are represented.
    3. Respect his 06:00 AM wake up time and exact timeline allocations.
    
    Output JSON ONLY in this exact structure:
    {{
        "workout_title": "Specific Title",
        "exercises": ["Movement 1 with sets/reps", "Movement 2 with sets/reps", "Yoga Posture"],
        "breakfast_components": ["Specific item 1", "Specific item 2"]
    }}
    """
    
    response = ai_client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    return json.loads(response.text)

def main():
    constraints, history = fetch_health_context()
    
    print("[JARVIS] Requesting dynamic health computation (with client-side retry handling)...")
    ai_plan = ask_gemini_to_build_day(constraints, history)
    
    service = get_tasks_service()
    list_id = get_or_create_list(service, "Health & Fitness")
    today = datetime.date.today().isoformat()
    
    master_title = f"⚠️ APPROVE PLAN: Matrix {today}"
    exists, master_id = task_exists(service, list_id, master_title, today)
    
    if exists:
        print(f"[JARVIS] Plan for {today} already deployed. Skipping to prevent duplicates.")
        return
        
    master_task = service.tasks().insert(tasklist=list_id, body={
        "title": master_title,
        "notes": "Generated dynamically by Gemini Core.",
        "due": today + "T00:00:00Z"
    }).execute()
    master_id = master_task['id']
    
    timeline_parent = service.tasks().insert(tasklist=list_id, body={"title": "⏰ Timeline Blocks (6AM Start)", "parent": master_id, "due": today + "T00:00:00Z"}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": "06:00 AM | Wake Up & Hydrate (500ml Water)", "parent": timeline_parent['id']}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": f"06:15 AM | Workout: {ai_plan['workout_title']}", "parent": timeline_parent['id']}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": "07:00 AM | Cool Down & Prepare Custom Breakfast", "parent": timeline_parent['id']}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": "07:30 AM | Consume Breakfast & Snapshot Log", "parent": timeline_parent['id']}).execute()

    workout_parent = service.tasks().insert(tasklist=list_id, body={"title": f"🏋️ Target Routine: {ai_plan['workout_title']}", "parent": master_id, "due": today + "T00:00:00Z"}).execute()
    for ex in ai_plan['exercises']:
        service.tasks().insert(tasklist=list_id, body={"title": ex, "parent": workout_parent['id']}).execute()

    diet_parent = service.tasks().insert(tasklist=list_id, body={"title": "🍴 Tailored Breakfast Requirements", "parent": master_id, "due": today + "T00:00:00Z"}).execute()
    for item in ai_plan['breakfast_components']:
        service.tasks().insert(tasklist=list_id, body={"title": item, "parent": diet_parent['id']}).execute()

    print("[JARVIS] Dynamic AI deployment successful and verified.")

if __name__ == "__main__":
    main()

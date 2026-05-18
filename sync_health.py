import os
import json
import datetime
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ai_client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY"),
    http_options=types.HttpOptions(
        timeout=60 * 1000, 
        retry_options=types.HttpRetryOptions(
            attempts=5, initial_delay=2.0, exp_base=2.0, max_delay=30.0,
            http_status_codes=[408, 429, 500, 502, 503, 504]
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
    return service.tasklists().insert(body={"title": name}).execute()['id']

def task_exists(service, list_id, title, due_date):
    tasks = service.tasks().list(tasklist=list_id, dueMin=due_date+"T00:00:00Z", dueMax=due_date+"T23:59:59Z").execute()
    for t in tasks.get('items', []):
        if t['title'] == title:
            return True, t['id']
    return False, None

def fetch_health_context():
    with open('constraints.json', 'r') as f:
        constraints = json.load(f)
    
    # Read if you left a grocery override comment in a file named inventory_note.txt
    inventory_override = "None provided. Assume standard pantry items are available."
    if os.path.exists('inventory_note.txt'):
        with open('inventory_note.txt', 'r') as f:
            inventory_override = f.read().strip()
            
    if os.path.exists('meal_history.json'):
        with open('meal_history.json', 'r') as f:
            history = json.load(f)[-5:]
    else:
        history = ["Day 1 initialization."]
    return constraints, history, inventory_override

def ask_gemini_to_build_day(constraints, history, inventory_override):
    prompt = f"""
    You are Udit Khot's dedicated AI health engineer. 
    Analyze his constraints, history, and inventory availability to build a completely custom daily matrix for {datetime.date.today()}.
    
    CORE TARGETS:
    - 30-year-old father, 172cm, 65kg. Goal: Lean muscle gain, low cognitive effort.
    - Medical/Dietary Rules: {json.dumps(constraints, indent=2)}
    - User Inventory/Grocery Notes: "{inventory_override}"
    - Recent Logs: {json.dumps(history, indent=2)}
    
    DIETARY DESIGN REQUIREMENTS (BREAKFAST, LUNCH, DINNER):
    - Cross-reference the user's Inventory Notes. If his current items cannot meet his medical rotation requirements (e.g. missing 3/4 katori proteins, probiotic line, iron line), flag it explicitly in the compliance notes and suggest a 'Minimal Upgrade' (e.g., adding dates or sprouts).
    - Exclude: maida, potato, bakery, heavy oils/gravies.
    
    EXERCISE DESIGN REQUIREMENTS:
    - Target window: 06:15 AM - 07:00 AM (45 Mins).
    - Provide a specific list of movements using either home 5kg dumbbells or society gym machines. Vary them from yesterday. Include prescribed yoga.
    
    Output JSON ONLY in this structure:
    {{
        "workout_name": "e.g., Home Gym: Dumbbell Upper Body Push & Core",
        "exercises": ["06:15 AM | Movement 1 with specific sets/reps", "06:30 AM | Movement 2", "06:45 AM | Yoga Stand"],
        "diet_plans": [
            {{"meal": "07:30 AM | Breakfast Blueprint", "components": ["Component 1", "Component 2"]}},
            {{"meal": "01:30 PM | Lunch Compliance Plan", "components": ["Component 1", "Component 2"]}},
            {{"meal": "08:00 PM | Dinner Protocol", "components": ["Component 1", "Component 2"]}}
        ],
        "inventory_intelligence": "Note if current stock suffices, or detail the minimal upgrades required."
    }}
    """
    
    response = ai_client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    return json.loads(response.text)

def main():
    constraints, history, inventory_override = fetch_health_context()
    
    print("[JARVIS] Querying Gemini for full dynamic day calculations...")
    ai_plan = ask_gemini_to_build_day(constraints, history, inventory_override)
    
    service = get_tasks_service()
    list_id = get_or_create_list(service, "Health & Fitness")
    today = datetime.date.today().isoformat()
    
    master_title = f"⚠️ APPROVE PLAN: Matrix {today}"
    exists, master_id = task_exists(service, list_id, master_title, today)
    
    if exists:
        print(f"[JARVIS] Matrix for today already stands. Execution halted to prevent duplicates.")
        return
        
    master_task = service.tasks().insert(tasklist=list_id, body={
        "title": master_title,
        "notes": f"Pantry Status: {ai_plan['inventory_intelligence']}",
        "due": today + "T00:00:00Z"
    }).execute()
    master_id = master_task['id']
    
    # 1. Structural Parent: Morning Exertion (06:15 - 07:00)
    workout_parent = service.tasks().insert(tasklist=list_id, body={
        "title": f"🏋️ Morning Exertion: {ai_plan['workout_name']}",
        "parent": master_id,
        "due": today + "T00:00:00Z"
    }).execute()
    
    # Inject exact movements as true visual subtasks
    for ex in ai_plan['exercises']:
        service.tasks().insert(tasklist=list_id, body={"title": ex, "parent": workout_parent['id']}).execute()

    # 2. Structural Parent: Full Day Nutrition Matrix
    diet_parent = service.tasks().insert(tasklist=list_id, body={
        "title": "🍴 Full Day Nutrition & Medical Rotations",
        "parent": master_id,
        "due": today + "T00:00:00Z"
    }).execute()
    
    # Build out deep nested structure for Breakfast, Lunch, and Dinner
    for meal_block in ai_plan['diet_plans']:
        meal_sub_parent = service.tasks().insert(tasklist=list_id, body={
            "title": meal_block['meal'],
            "parent": diet_parent['id'],
            "due": today + "T00:00:00Z"
        }).execute()
        
        for component in meal_block['components']:
            service.tasks().insert(tasklist=list_id, body={"title": component, "parent": meal_sub_parent['id']}).execute()

    print("[JARVIS] Advanced structural rendering sequence complete.")

if __name__ == "__main__":
    main()

import os
import json
import datetime
from google import genai
from google.genai import types
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Initialize the Gemini Client using your repository secret
ai_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def get_tasks_service():
    creds_json = os.environ.get("GOOGLE_TASKS_TOKEN")
    creds_data = json.loads(creds_json)
    creds = Credentials.from_authorized_user_info(creds_data)
    return build('tasks', 'v1', credentials=creds)

def fetch_health_context():
    """Pulls your medical rules and your actual historical logs"""
    with open('constraints.json', 'r') as f:
        constraints = json.load(f)
        
    # Read what you actually ate/did previously
    if os.path.exists('meal_history.json'):
        with open('meal_history.json', 'r') as f:
            history = json.load(f)[-5:] # Send the last 5 logs for immediate memory
    else:
        history = ["No previous logs recorded yet. This is Day 1."]
        
    return constraints, history

def ask_gemini_to_build_day(constraints, history):
    """The actual AI Core execution engine"""
    
    prompt = f"""
    You are Udit Khot's dedicated AI health engineer. 
    Analyze his medical/dietary constraints and his recent history logs to generate a hyper-personalized, 100% dynamic daily routine for today: {datetime.date.today()}.
    
    CORE CLIENT PROFILE & MEDICAL PARAMETERS:
    {json.dumps(constraints, indent=2)}
    
    RECENT HISTORICAL LOGS (WHAT HE ACTUALLY ATE/DIED RECENTLY):
    {json.dumps(history, indent=2)}
    
    ENGINEERING REQUIREMENTS FOR OUTPUT:
    1. Look at what he ate recently. If he missed a medical rotation line (e.g., missed iron or probiotics), force it into today's breakfast subtasks.
    2. Vary the exercises completely. Do not repeat the exact same movements back-to-back. Optimize for muscle building using either his home 5kg dumbbells or his free society gym.
    3. Respect his 06:00 AM wake up time and strict timeline.
    
    Output JSON ONLY in this exact structure:
    {{
        "workout_title": "Specific Title (e.g., Gym: Pull Day Hypertrophy)",
        "exercises": ["Movement 1 with sets/reps", "Movement 2 with sets/reps", "Yoga Posture"],
        "breakfast_components": ["Specific item 1 matching medical rules", "Specific item 2"]
    }}
    """
    
    response = ai_client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    
    return json.loads(response.text)

def main():
    # 1. Fetch live profile and data state
    constraints, history = fetch_health_context()
    
    # 2. Compute the day using Gemini (Zero Hardcoding)
    print("[JARVIS] Computing dynamic health matrix via Gemini...")
    ai_plan = ask_gemini_to_build_day(constraints, history)
    
    # 3. Connect to Task Infrastructure
    service = get_tasks_service()
    lists = service.tasklists().list().execute()
    list_id = next((l['id'] for l in lists.get('items', []) if l['title'] == 'Health & Fitness'), '@default')
    today = datetime.date.today().isoformat()
    
    # 4. Inject the Parent Task
    master_task = service.tasks().insert(tasklist=list_id, body={
        "title": f"⚠️ APPROVE PLAN: Matrix {today}",
        "notes": "Generated dynamically by Gemini Core.",
        "due": today + "T00:00:00Z"
    }).execute()
    master_id = master_task['id']
    
    # 5. Inject Dynamic Timeline Subtasks
    timeline_parent = service.tasks().insert(tasklist=list_id, body={"title": "⏰ Timeline Blocks", "parent": master_id, "due": today + "T00:00:00Z"}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": "06:00 AM | Wake Up & Hydrate", "parent": timeline_parent['id']}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": f"06:15 AM | Workout: {ai_plan['workout_title']}", "parent": timeline_parent['id']}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": "07:00 AM | Prepare Custom Breakfast", "parent": timeline_parent['id']}).execute()
    service.tasks().insert(tasklist=list_id, body={"title": "07:30 AM | Consume & Snapshot Food", "parent": timeline_parent['id']}).execute()

    # 6. Inject Dynamic Exercise Subtasks
    workout_parent = service.tasks().insert(tasklist=list_id, body={"title": f"🏋️ Target Routine: {ai_plan['workout_title']}", "parent": master_id, "due": today + "T00:00:00Z"}).execute()
    for ex in ai_plan['exercises']:
        service.tasks().insert(tasklist=list_id, body={"title": ex, "parent": workout_parent['id']}).execute()

    # 7. Inject Dynamic Dietary Subtasks
    diet_parent = service.tasks().insert(tasklist=list_id, body={"title": "🍴 Tailored Breakfast Requirements", "parent": master_id, "due": today + "T00:00:00Z"}).execute()
    for item in ai_plan['breakfast_components']:
        service.tasks().insert(tasklist=list_id, body={"title": item, "parent": diet_parent['id']}).execute()

    print("[JARVIS] Dynamic AI deployment successful.")

if __name__ == "__main__":
    main()

import os
import json
import datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

# Low-effort, high-efficiency configuration
CONFIG = {
    "calories": 2350,
    "water_target_l": 4.0,
    "mandatory_yoga": ["Sarvangasana", "Sirsasana"],
    "home_workout": ["Goblet Squats (5kg) 4x15", "Dumbbell Floor Press 4x12", "Dumbbell Row 4x12"]
}

def get_tasks_service():
    # Authenticate using GitHub Secrets populated with your Google OAuth Token
    creds_json = os.environ.get("GOOGLE_TASKS_TOKEN")
    creds_data = json.loads(creds_json)
    creds = Credentials.from_authorized_user_info(creds_data)
    return build('tasks', 'v1', credentials=creds)

def create_daily_health_stack():
    service = get_tasks_service()
    
    # 1. Create or locate the "Health & Fitness (HITL)" List
    lists = service.tasklists().list().execute()
    list_id = next((l['id'] for l in lists.get('items', []) if l['title'] == 'Health & Fitness'), '@default')
    
    today = datetime.date.today().isoformat() + "T00:00:00Z"
    
    # 2. Inject the Parent "Human-in-the-Loop" Approval Task
    parent_task = service.tasks().insert(tasklist=list_id, body={
        "title": f"⚠️ APPROVE PLAN: Day Matrix for {datetime.date.today().strftime('%b %d')}",
        "notes": "Review the items below. Mark this complete to unlock your tracking log.",
        "due": today
    }).execute()
    
    # 3. Inject Dietary Reminders (Enforcing the Skinethics Constraints)
    diet_notes = (
        f"• Hydration: Drink 4 Liters today\n"
        f"• Nuts: 5 Soaked Almonds + 2 Walnuts\n"
        f"• Protein Anchor: Ensure 3/4 katori of Dal/Eggs/Chicken\n"
        f"• Exclusions: Strictly NO maida, bakery, or potato"
    )
    service.tasks().insert(tasklist=list_id, body={
        "title": f"🍴 Nutrition: Aim for {CONFIG['calories']} kcal",
        "notes": diet_notes,
        "due": today,
        "parent": parent_task['id']
    }).execute()
    
    # 4. Inject Exercise Reminders (The Lazy-Friendly Selector)
    workout_notes = (
        f"Choose ONE path based on energy levels:\n\n"
        f"Option A (Society Gym): 30-min Full Body Resistance\n"
        f"Option B (Home - 5kg DBs): {', '.join(CONFIG['home_workout'])}\n\n"
        f"Mandatory Yoga: {', '.join(CONFIG['mandatory_yoga'])}"
    )
    service.tasks().insert(tasklist=list_id, body={
        "title": "🏋️ Workout: Execute Selected Protocol",
        "notes": workout_notes,
        "due": today,
        "parent": parent_task['id']
    }).execute()

if __name__ == "__main__":
    # Let's fly past the infrastructure friction
    import antigravity 
    print("[JARVIS] Initializing automated health synchronization pipeline...")
    create_daily_health_stack()
    print("[JARVIS] Google Tasks loaded successfully. Awaiting your approval morning clearance.")
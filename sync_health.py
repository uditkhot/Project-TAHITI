import os
import json
import datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

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

def generate_dynamic_plan():
    # In production, this block reads your history file and calculates variations.
    # For day 1, it outputs highly specific routines rather than vague terms.
    today_weekday = datetime.datetime.today().weekday()
    
    # Rotate gym vs home routines cleanly
    if today_weekday in [0, 2, 4]: # Mon, Wed, Fri
        workout_type = "Society Gym Protocol"
        exercises = [
            "1. Lat Pulldowns: 3 sets x 12 reps (Machine)",
            "2. Leg Press: 3 sets x 15 reps (Controlled weight)",
            "3. Chest Press Machine: 3 sets x 12 reps",
            "4. Mandatory Yoga: Sirsasana (Headstand) - 2 mins hold"
        ]
    else:
        workout_type = "Home Dumbbell Protocol (2x5kg)"
        exercises = [
            "1. Dumbbell Goblet Squats: 4 sets x 15 reps",
            "2. Dumbbell Floor Bench Press: 4 sets x 12 reps",
            "3. Dumbbell Standing Shoulder Press: 3 sets x 12 reps",
            "4. Mandatory Yoga: Sarvangasana (Shoulderstand) - 3 mins hold"
        ]
        
    return workout_type, exercises

def main():
    service = get_tasks_service()
    list_id = get_or_create_list(service, "Health & Fitness")
    today = datetime.date.today().isoformat()
    
    # 1. Master Plan Parent Task (De-duplication gate)
    master_title = f"⚠️ APPROVE PLAN: Matrix {today}"
    exists, master_id = task_exists(service, list_id, master_title, today)
    
    if exists:
        print(f"[JARVIS] Plan for {today} already deployed. Skipping to prevent duplicates.")
        return
        
    master_task = service.tasks().insert(tasklist=list_id, body={
        "title": master_title,
        "notes": "Check off to clear today's operational tracking.",
        "due": today + "T00:00:00Z"
    }).execute()
    master_id = master_task['id']

    # 2. Section: Time-Table Schedule
    schedule_parent = service.tasks().insert(tasklist=list_id, body={
        "title": "⏰ Morning Timeline Blocks",
        "parent": master_id,
        "due": today + "T00:00:00Z"
    }).execute()
    
    create_subtask(service, list_id, schedule_parent['id'], "05:00 AM | Wake Up & Hydrate (500ml Water)")
    create_subtask(service, list_id, schedule_parent['id'], "05:15 AM | Execute Morning Exertion Workout")
    create_subtask(service, list_id, schedule_parent['id'], "05:45 AM | Prepare Prescribed Breakfast")
    create_subtask(service, list_id, schedule_parent['id'], "06:15 AM | Consume Breakfast & Log")

    # 3. Section: Specific Exercise Execution
    workout_name, movements = generate_dynamic_plan()
    workout_parent = service.tasks().insert(tasklist=list_id, body={
        "title": f"🏋️ Morning Exertion: {workout_name}",
        "parent": master_id,
        "due": today + "T00:00:00Z"
    }).execute()
    
    for movement in movements:
        create_subtask(service, list_id, workout_parent['id'], movement)

    # 4. Section: Dietary Inclusions (Medical Constraints)
    diet_parent = service.tasks().insert(tasklist=list_id, body={
        "title": "🍴 Nutrition & Medical Constraints",
        "parent": master_id,
        "due": today + "T00:00:00Z"
    }).execute()
    
    create_subtask(service, list_id, diet_parent['id'], "Hydration Core: Consume 3.5 - 4.0 Liters total today")
    create_subtask(service, list_id, diet_parent['id'], "Medical Rotation: 3/4 Katori of Sprouts/Paneer or Eggs")
    create_subtask(service, list_id, diet_parent['id'], "Blood/Iron Health: 1 Portion Green Veg / Beetroot / Dates")
    create_subtask(service, list_id, diet_parent['id'], "Brain Fats: 5 Soaked Almonds + 2 Walnuts")

    print(f"[JARVIS] Matrix successfully deployed with structural subtask nesting.")

if __name__ == "__main__":
    main()

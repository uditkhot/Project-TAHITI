Project TAHITI: Automated Agentic Health Matrix
Project TAHITI is an automated, closed-loop, Human-in-the-Loop (HITL) health and fitness ecosystem designed specifically for Udit Khot. It replaces the manual overhead of closed platforms by leveraging advanced LLM reasoning and multimodal computer vision to dynamically manage your diet, medical restrictions, and muscle-building routines directly through your daily schedule.

1. System Architecture & Data Flow
The ecosystem functions as an automated feedback loop executing across four distinct phases:

[ Day-to-Day Operation ]
User takes photo of meal ──> Dropped into pending_meals/ ──> GitHub Repo Storage

[ Every Morning at 05:00 AM IST ]
GitHub Actions Trigger ──> Run analyze_meal.py ──> Updates meal_history.json
                                                           │
                                                           v
Google Tasks Checklist <── Run sync_health.py <── Reads constraints.json & inventory_note.txt
Retrospective Vision Ingestion (analyze_meal.py): The vision engine scans for new snapshots in the pending_meals/ directory. It uses Gemini to compute macronutrients while cross-referencing your medical guidelines (ensuring no hidden maida, heavy gravies, or excessive dairy) and appends it to your historical record.

Context Assembly: The core framework loads your permanent biological/medical boundaries (constraints.json), your recent nutritional memory (meal_history.json), and your current refrigerator availability (inventory_note.txt).

Predictive Generation: Gemini computes the optimal strategy for the day. If previous logs show a nutritional deficit (e.g., missed protein or iron targets), it dynamically forces them into today's menu. It alternates your workout movements dynamically so you don't stall.

Structured Deployment (sync_health.py): The orchestration engine establishes a secure handshake with the Google Tasks API, evaluates existing entries to prevent duplicates, and maps the output into a clean, nested subtask tree on your phone.

2. Configuration & Customization Files
constraints.json
This is your permanent medical and biological guardrail file, populated directly from your clinical evaluation. The AI is strictly barred from recommending any item on the exclusion lists.

JSON
{
  "client_metadata": {
    "name": "Udit Khot",
    "age": 30,
    "height_cm": 172,
    "weight_kg": 65,
    "surgical_history": ["Splenectomy (2017) - Prioritize immune/gut support"]
  },
  "medical_guardrails": {
    "dietary_exclusions": ["maida", "bakery_products", "excessive_cheese", "groundnut_gravy", "coconut_gravy"],
    "dietary_reductions": ["sugar", "potato", "dairy", "high_oil"],
    "mandatory_daily_inclusions": {
      "protein_katori_0_75": ["dal", "soyabean", "sprouts", "paneer", "mushroom", "rajma", "chole", "egg", "chicken", "fish"],
      "nuts": {"soaked_almonds": 5, "walnuts": 2},
      "blood_health_portion": ["green_veg", "beetroot", "dates", "jaggery", "black_raisins", "meat"],
      "fermented_or_probiotic": ["idli", "dosa", "dhokla", "curd_probiotic"]
    },
    "hydration_target_liters": 4.0
  }
}
inventory_note.txt (The Grocery Dialog)
Use this file to talk to the AI about what is currently in your kitchen.

Example Content: "Pantry status: Out of paneer and sprouts. Have chicken, eggs, and spinach."

AI Action: Gemini reads this text, alters your meals to use the eggs and chicken, flags that you are missing your probiotic line for the day, and writes a warning note directly inside your task dashboard suggesting a quick item upgrade.

3. Daily User Operations Guide
To run your health ecosystem with absolute minimum friction, follow these three daily steps:

Step 1: The Morning Check-In (06:00 AM)
When you wake up at 6:00 AM, open your Google Tasks app. You will see a master parent task titled: ⚠️ APPROVE PLAN: Matrix [Date].
Expand it to view your personalized subtask trees:

⏰ Morning Timeline Blocks: Your automated timeline (06:00 AM Hydrate, 06:15 AM Workout, 07:00 AM Cool-down/Prep, 07:30 AM Eat Breakfast).

🏋️ Morning Exertion: Highly specific workout movements tailored to your location (Home 5kg Dumbbells or Society Gym machines) along with your mandatory Sirsasana/Sarvangasana clinical yoga routines.

🍴 Tailored Nutrition Matrix: Your custom Breakfast, Lunch, and Dinner component blueprints matching your medical metrics.

Step 2: The Meal Tracking Snapshot
Whenever you are about to consume a meal:

Snap a quick photo of the plate on your smartphone.

Open the GitHub Mobile App, navigate to your private tony-stark-health-core repository, and upload the image directly into the pending_meals/ folder.

That is it. The system will silently process, calculate, log, and delete that image at 5:00 AM the following morning.

Step 3: Evening Pantry Updates (Optional)
Before going to sleep, if you notice your kitchen stock is running low or changing, open your inventory_note.txt file via GitHub on your phone and type what you have available. This ensures the 5:00 AM routine generation adapts seamlessly without suggesting recipes you cannot cook.

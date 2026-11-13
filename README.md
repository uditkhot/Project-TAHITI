# PROJECT TAHITI (v2.0)
### Mobile-First Body Recomposition & Hypertrophy Telemetry Matrix

> **"It's a magical place."** — Project TAHITI is a mobile-first Progressive Web App (PWA) designed with an MCU / JARVIS tactical aesthetic. It provides closed-loop tracking for daily morning biometrics, clockwork precision nutrition (1-tap presets & Gemini Vision AI), progressive overload gym logging, 7-day telemetry uplink generation, and asynchronous cloud synchronization to Google Sheets.

---

## ⚡ Core Architecture

```
┌────────────────────────────────────────────────────────┐
│             PROJECT TAHITI PWA (v2.0)                  │
│       Obsidian Slate-950 & Cyan-400 JARVIS HUD         │
└──────────────────────────┬─────────────────────────────┘
                           │
         ┌─────────────────┼──────────────────┐
         ▼                 ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│  localStorage   │ │  Gemini API  │ │ Google Sheets    │
│  Offline Vault  │ │  Multimodal  │ │ Apps Script Web  │
│  (tahiti_v2_    │ │  Vision &    │ │ Webhook Engine   │
│   state)        │ │  Reasoning   │ │ (Code.gs)        │
└─────────────────┘ └──────────────┘ └──────────────────┘
```

- **Frontend:** Single-page PWA (`index.html`, `app.js`, `manifest.json`, `sw.js`) styled with Tailwind CSS CDN and Lucide Icons.
- **Offline First:** Cached via Service Worker. All operations read and write to `localStorage` immediately with zero network latency.
- **AI Nutrition Vision:** Multimodal Gemini API endpoint (`gemini-2.5-flash` or `gemini-3-flash-preview`) with camera capture / photo upload returning structured nutritional JSON.
- **Cloud Telemetry Sink:** Google Apps Script backend (`Code.gs`) that automatically logs and upserts data across 4 dedicated sheets in Google Sheets.
- **Coach Uplink:** 1-tap "Copy 7-Day Telemetry" button that compiles weekly averages, compliance rates, and lift progressions into a Markdown report formatted for Gemini.

---

## 📱 Modules & Features

### 1. Top HUD (Heads-Up Display)
- **Caloric Gauge:** Real-time budget tracking (Default: 1,650 kcal) with remaining kcal badge and overflow indicators.
- **Macro Matrix:** Three-column progress bars for:
  - **Protein:** 140g target (Sky-400 bar)
  - **Carbs:** 130g target (Emerald-400 bar)
  - **Fat:** 50g target (Amber-400 bar)
- **Step Telemetry:** Live counter against 8,000 daily steps target.

### 2. Tab 1: Daily Biometrics & Core Habits
- **Fasted Morning Metrics:** Fasted Weight (kg), Subcutaneous Fat (kg), Waist Navel Braced (in), Waist Navel Relaxed (in), and Daily Steps (with `+1k`, `+2k`, `+5k` rapid increments).
- **Previous Session Trend:** Automatically highlights weight delta ($\pm\text{kg}$) compared against the most recent prior weigh-in.
- **Daily Non-Negotiable Toggles:**
  - `Stomach Vacuums (4x20s)` — Transversus abdominis activation
  - `Cook Oil Audit (<=1 tsp)` — Elimination of hidden restaurant/cooking fats
  - `Coke Zero Limit (Max 1 Can)` — Appetite discipline and sweetener audit
- **Autosave Engine:** Every input and toggle immediately commits to local telemetry.

### 3. Tab 2: Clockwork Nutrition (1-Tap Presets + AI Vision)
- **1-Tap Macro Presets:**
  - `[09:00 AM]` 3 Whole Eggs + 2 Whites + 1 Toast (340 kcal | 28g P | 15g C | 18g F)
  - `[11:15 AM]` 1 Scoop Whey Isolate (120 kcal | 27g P | 1g C | 0.5g F)
  - `[01:30 PM]` Cook's 2 Phulkas + Bhaji + 150g Air-Fried Chicken + Chaas (550 kcal | 42g P | 58g C | 14g F)
  - `[01:30 PM - Veg Alt]` Cook's 2 Phulkas + Bhaji + 100g Low-Fat Paneer + Chaas (540 kcal | 28g P | 60g C | 20g F)
  - `[08:30 PM]` Rutuja's Chicken Wrap - 180g Chicken + Roti + Hung Curd (560 kcal | 46g P | 45g C | 18g F)
  - `[08:30 PM]` Rutuja's 200g Tandoori/Grilled Chicken + Veggies (480 kcal | 48g P | 18g C | 20g F)
  - `[08:30 PM]` 150g Low-Fat Paneer Tikka/Bhurji + 1 Phulka (540 kcal | 36g P | 38g C | 24g F)
- **JARVIS Multimodal Meal Analyzer:**
  - Camera snapshot or gallery image upload.
  - Text description input for off-menu items.
  - Invokes `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` with `responseMimeType: "application/json"`.
  - Preview card allows instant review and fine-tuning before committing to the log.
- **Logged Meals Feed:** Chronological list for the active date with individual macro pills and 1-tap delete button.

### 4. Tab 3: 10:15 AM Gym Logger (Progressive Overload)
- **Split Selectors:**
  - `Upper Body` (Incline DB Press, Lat Pulldown / DB Row, Seated DB Shoulder Press, DB Lateral Raises, Cable Tricep Pushdown, DB Bicep Curls, Weighted Cable/Bench Crunches)
  - `Lower & Core` (DB Goblet Squats, DB Romanian Deadlifts, DB Walking Lunges, Standing Calf Raises, Hanging Knee / Lying Leg Raises, RKC Plank)
  - `MED Failsafe` (Incline DB Press, Lat Pulldown / DB Row, DB Goblet Squats, DB Romanian Deadlifts, DB Lateral Raises, RKC Plank)
- **Top Set History Engine:**
  - Scans historical session data across all previous dates.
  - Displays a tactical badge above each movement: `⚡ Last Session Top Set: 26 kg × 8 reps`.
- **Dynamic Sets Table:**
  - Weight (kg) & Reps inputs per set.
  - Completed checkmark toggle.
  - `+ Add Set` and remove set controls.
  - Real-time tonnage accumulation badge (`X,XXX kg Tonnage`).

### 5. Tab 4: JARVIS Uplink & Settings
- **7-Day Telemetry Compiler:**
  - Generates a dense Markdown report synthesizing the rolling 7-day average calories, macros, step counts, habit compliance, and workout volume.
  - Copies to clipboard formatted as an expert coach briefing prompt for Gemini.
- **Configurable Settings:**
  - Daily Targets (Kcal, Protein, Carbs, Fat, Steps).
  - Gemini API Key (stored in browser `localStorage` only).
  - Gemini Model Selector (default: `gemini-2.5-flash`; swap to `gemini-3-flash-preview` anytime).
  - Google Apps Script Webhook URL.
  - 1-Tap Presets Manager (create, edit, delete, or restore factory defaults).
  - Exercise Routine Manager (add, edit, remove movements per split).
  - Telemetry Vault (Export JSON backup, Import backup, Factory Reset).

---

## 🚀 Setup & Deployment Guide

### A. GitHub Pages Hosting
1. Commit and push the repository to GitHub (`https://github.com/uditkhot/Project-TAHITI.git`).
2. Go to repository **Settings** > **Pages**.
3. Under **Branch**, select `main` branch and `/ (root)` directory.
4. Click **Save**.
5. Your PWA will be live at:
   `https://uditkhot.github.io/Project-TAHITI/`

### B. Google Sheets Telemetry Webhook Setup
1. Create a new Google Spreadsheet (e.g. named `TAHITI Telemetry Matrix`).
2. Go to **Extensions** > **Apps Script**.
3. Open `Code.gs` and replace all contents with the code from [`Code.gs`](Code.gs).
4. Click **Save** (💾).
5. Click **Deploy** > **New deployment**.
6. Select type: **Web app**.
7. Set:
   - **Description:** `TAHITI v2.0 Webhook`
   - **Execute as:** `Me` (your Google account)
   - **Who has access:** `Anyone`
8. Click **Deploy** and authorize permissions when prompted.
9. Copy the **Web app URL** (`https://script.google.com/macros/s/.../exec`).
10. Open Project TAHITI > Tab 4 (Uplink) > Paste into **Google Apps Script Webhook URL**.

Sheets created automatically:
- `Biometrics` (Date, Weight, Subcut Fat, Waist Braced, Waist Relaxed, Steps, Habits, Timestamp)
- `Nutrition` (Date, Time, Meal Name, Calories, Protein, Carbs, Fat, Source, Meal ID, Timestamp)
- `Workouts` (Date, Split, Exercise, Set #, Weight, Reps, Volume, Completed, Timestamp)
- `DailySummary` (Date, Calories, Macros, Steps, Tonnage, Habits Completed, Timestamp)

### C. Gemini Vision AI Setup
1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/).
2. In Project TAHITI, switch to **Tab 4 (Uplink & Settings)**.
3. Paste your key into the **Gemini API Key** field.
4. Verify the model is set to `gemini-2.5-flash` (or your preferred Gemini model).

---

## 🔒 Privacy & Local-First Guarantees
- All biometrics, meals, and gym logs are stored locally on your device in `localStorage`.
- Your Gemini API key never leaves your browser; requests are sent directly from your device to Google Generative Language API.
- Cloud sync occurs only when you tap **Sync** or configure your personal Google Apps Script webhook.

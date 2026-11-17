/**
 * ============================================================================
 * PROJECT TAHITI (v2.0) — APPLICATION CORE ENGINE (app.js)
 * Mobile-First Body Recomposition & Telemetry HUD
 * ============================================================================
 */

(function () {
  'use strict';

  // --- CONSTANTS & DEFAULT STATE SCHEMAS ---
  const STORAGE_KEY = 'tahiti_v2_state';

  const DEFAULT_TARGETS = {
    calories: 1650,
    protein: 140,
    carbs: 130,
    fat: 50,
    steps: 8000
  };

  const DEFAULT_PRESETS = [
    {
      id: 'p-1',
      time: '09:00 AM',
      name: '3 Whole Eggs + 2 Whites + 1 Toast',
      kcal: 340,
      protein: 28,
      carbs: 15,
      fat: 18
    },
    {
      id: 'p-2',
      time: '11:15 AM',
      name: '1 Scoop Whey Protein (Water/Milk)',
      kcal: 130,
      protein: 25,
      carbs: 3,
      fat: 2
    },
    {
      id: 'p-3',
      time: '01:30 PM',
      name: "Cook's 2 Phulkas (no oil) + Bhaji + 150g Air-Fried Chicken",
      kcal: 510,
      protein: 40,
      carbs: 54,
      fat: 13
    },
    {
      id: 'p-4',
      time: '01:30 PM',
      name: "Cook's 2 Phulkas (no oil) + Bhaji + 100g Low-Fat Paneer",
      kcal: 500,
      protein: 26,
      carbs: 56,
      fat: 19
    },
    {
      id: 'p-5',
      time: '01:30 PM',
      name: "Cook's 2 Phulkas (no oil) + Bhaji + 50g Soya Chunks",
      kcal: 470,
      protein: 34,
      carbs: 68,
      fat: 6
    },
    {
      id: 'p-6',
      time: '08:30 PM',
      name: "Rutuja's Chicken Wrap (180g Chicken + Whole Wheat Roti)",
      kcal: 540,
      protein: 46,
      carbs: 45,
      fat: 16
    },
    {
      id: 'p-7',
      time: '08:30 PM',
      name: "Rutuja's 200g Tandoori/Grilled Chicken + Sautéed Veggies",
      kcal: 480,
      protein: 48,
      carbs: 18,
      fat: 20
    },
    {
      id: 'p-8',
      time: '08:30 PM',
      name: '150g Low-Fat Paneer Tikka/Bhurji + 1 Phulka',
      kcal: 540,
      protein: 36,
      carbs: 38,
      fat: 24
    }
  ];

  const DEFAULT_EXERCISES = {
    upper: [
      'Incline DB Press (30° Bench)',
      'Wide-Grip Lat Pulldown (High Pulley)',
      'Seated Chest Press (Vertical Neutral Grip)',
      'Standing DB Shoulder Press',
      'Standing DB Lateral Raises',
      'DB Bicep Curls',
      'Overhead DB Tricep Extension',
      'Decline Bench Crunches (Foot Rollers)'
    ],
    lower: [
      'Seated Machine Leg Press',
      'DB / Barbell Romanian Deadlifts',
      'DB Goblet Squats',
      'Seated Leg Extension',
      "Captain's Chair Knee Raises (Pelvic Curl)",
      'RKC Floor Plank (Seconds)'
    ],
    full: [
      'Incline DB Press (30° Bench)',
      'Wide-Grip Lat Pulldown (High Pulley)',
      'Seated Machine Leg Press',
      'DB / Barbell Romanian Deadlifts',
      'Standing DB Lateral Raises',
      'Decline Bench Crunches (Foot Rollers)'
    ]
  };

  // --- GLOBAL STATE ---
  let state = {
    version: 2.3,
    settings: {
      geminiApiKey: '',
      geminiModel: 'gemini-2.5-flash',
      gasWebhookUrl: '',
      targets: { ...DEFAULT_TARGETS },
      presets: JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
      exercises: JSON.parse(JSON.stringify(DEFAULT_EXERCISES))
    },
    days: {}
  };

  let activeDate = getTodayDateString();
  let aiImageBase64 = null;
  let aiImageMime = null;

  // --- HELPER UTILITIES ---

  function getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatTimeNow() {
    const d = new Date();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }

  function ensureDay(dateStr) {
    if (!state.days[dateStr]) {
      state.days[dateStr] = {
        biometrics: {
          weight: null,
          subcutaneousFat: null,
          waistBraced: null,
          waistRelaxed: null,
          steps: 0
        },
        habits: {
          vacuums: false,
          cookOil: false,
          cokeZero: false
        },
        meals: [],
        workouts: {
          activeSplit: 'upper',
          exercises: {},
          finishedExercises: []
        },
        synced: false,
        lastModified: new Date().toISOString()
      };
    } else {
      // Ensure sub-objects exist in case of partial structures
      if (!state.days[dateStr].biometrics) {
        state.days[dateStr].biometrics = { weight: null, subcutaneousFat: null, waistBraced: null, waistRelaxed: null, steps: 0 };
      }
      if (!state.days[dateStr].habits) {
        state.days[dateStr].habits = { vacuums: false, cookOil: false, cokeZero: false };
      }
      if (!Array.isArray(state.days[dateStr].meals)) {
        state.days[dateStr].meals = [];
      }
      if (!state.days[dateStr].workouts) {
        state.days[dateStr].workouts = { activeSplit: 'upper', exercises: {}, finishedExercises: [] };
      }
      if (!state.days[dateStr].workouts.exercises) {
        state.days[dateStr].workouts.exercises = {};
      }
      if (!Array.isArray(state.days[dateStr].workouts.finishedExercises)) {
        state.days[dateStr].workouts.finishedExercises = [];
      }
    }
    return state.days[dateStr];
  }

  // --- STORAGE LOAD & SAVE ---

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const currentVersion = Number(parsed.version || 2);
          let presets = parsed.settings?.presets;
          let exercises = parsed.settings?.exercises;

          // Detect if presets contain old curd/chaas/rice items or version < 2.2
          const hasOldPresets = Array.isArray(presets) && presets.some(p => 
            p.name && (p.name.includes('Chaas') || p.name.includes('Curd') || p.name.includes('Whey Isolate') || p.name.includes('Hung Curd'))
          );

          if (currentVersion < 2.2 || hasOldPresets) {
            console.log('[TAHITI] Upgrading to v2.2 schema (Elina gym hardware & zero-curd presets)...');
            // Preserve user-added custom presets (IDs that don't match old default IDs p-1..p-7)
            const oldDefaultIds = new Set(['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7']);
            const customPresets = Array.isArray(presets) 
              ? presets.filter(p => !oldDefaultIds.has(p.id) && !p.id.startsWith('p-')) 
              : [];
            
            presets = [...JSON.parse(JSON.stringify(DEFAULT_PRESETS)), ...customPresets];
            exercises = JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
          }

          // Merge settings
          state.settings = {
            ...state.settings,
            ...(parsed.settings || {}),
            targets: { ...DEFAULT_TARGETS, ...(parsed.settings?.targets || {}) },
            presets: presets && presets.length > 0 ? presets : JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
            exercises: exercises || JSON.parse(JSON.stringify(DEFAULT_EXERCISES))
          };
          state.version = 2.2;
          state.days = parsed.days || {};
          console.log('[TAHITI] State loaded successfully from localStorage (v2.2)');
        }
      } else {
        // Try migrating from legacy prototype state if present
        migrateLegacyState();
      }
    } catch (e) {
      console.error('[TAHITI] Error loading state from localStorage:', e);
    }
    ensureDay(activeDate);
  }

  let isSyncingInProgress = false;

  function setSyncLoading(isLoading, badgeText = 'SYNCING') {
    isSyncingInProgress = isLoading;
    const syncStatusBadge = document.getElementById('syncStatusBadge');
    const syncIcon = document.getElementById('syncIcon');

    if (isLoading && syncStatusBadge && badgeText) {
      syncStatusBadge.textContent = badgeText;
    }
    if (syncIcon) {
      if (isLoading) {
        syncIcon.classList.add('animate-spin');
      } else {
        syncIcon.classList.remove('animate-spin');
      }
    }
  }

  function saveState(markSynced = false) {
    try {
      if (state.days[activeDate]) {
        state.days[activeDate].lastModified = new Date().toISOString();
        if (markSynced === true) {
          state.days[activeDate].synced = true;
        } else if (markSynced === false) {
          state.days[activeDate].synced = false;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSyncStatusUI();
    } catch (e) {
      console.error('[TAHITI] Error saving state:', e);
      showToast('Storage write failed (Quota exceeded?)', 'alert-triangle');
    }
  }

  function migrateLegacyState() {
    try {
      const legacyRaw = localStorage.getItem('tahiti_app_state');
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        if (legacy && legacy.history) {
          console.log('[TAHITI] Found legacy Streamlit state, migrating history...');
          for (const d in legacy.history) {
            const dayRecord = ensureDay(d);
            const legacyDay = legacy.history[d];
            if (legacyDay.meals && typeof legacyDay.meals === 'object') {
              for (const mealKey in legacyDay.meals) {
                const list = legacyDay.meals[mealKey];
                if (Array.isArray(list)) {
                  list.forEach((m) => {
                    dayRecord.meals.push({
                      id: 'migrated-' + Math.random().toString(36).substr(2, 9),
                      time: '12:00 PM',
                      name: m.meal_estimation || 'Legacy Meal',
                      kcal: m.nutrients?.calories || 0,
                      protein: m.nutrients?.protein_g || 0,
                      carbs: m.nutrients?.carbs_g || 0,
                      fat: m.nutrients?.fat_g || 0,
                      source: 'legacy'
                    });
                  });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[TAHITI] Legacy migration skipped:', err);
    }
  }

  // --- UI RENDER ENGINES ---

  function refreshAllUI() {
    ensureDay(activeDate);
    renderHeaderAndChronometer();
    renderTopHUD();
    renderTabBiometrics();
    renderTabNutrition();
    renderTabGym();
    renderTabSettings();
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // 1. Header & Chronometer
  function renderHeaderAndChronometer() {
    const datePicker = document.getElementById('datePicker');
    if (datePicker) {
      datePicker.value = activeDate;
    }
    updateSyncStatusUI();
  }

  function updateSyncStatusUI() {
    const currentDay = ensureDay(activeDate);
    const syncStatusBadge = document.getElementById('syncStatusBadge');
    const syncIcon = document.getElementById('syncIcon');
    const headerStatusText = document.getElementById('headerStatusText');
    const webhookStatusIndicator = document.getElementById('webhookStatusIndicator');

    if (!isSyncingInProgress && syncIcon) {
      syncIcon.classList.remove('animate-spin');
    }

    if (isSyncingInProgress) return;

    if (!state.settings.gasWebhookUrl) {
      if (syncStatusBadge) syncStatusBadge.textContent = 'LOCAL';
      if (webhookStatusIndicator) {
        webhookStatusIndicator.textContent = 'No Webhook URL';
        webhookStatusIndicator.className = 'text-[10px] font-mono text-amber-400';
      }
      return;
    }

    if (webhookStatusIndicator) {
      webhookStatusIndicator.textContent = 'Webhook Configured';
      webhookStatusIndicator.className = 'text-[10px] font-mono text-emerald-400';
    }

    if (currentDay.synced) {
      if (syncStatusBadge) syncStatusBadge.textContent = 'SYNCED';
      if (headerStatusText) headerStatusText.textContent = 'TELEMETRY SYNCED';
    } else {
      if (syncStatusBadge) syncStatusBadge.textContent = 'SYNC';
      if (headerStatusText) headerStatusText.textContent = 'CHANGES LOCAL';
    }
  }

  // 2. Top Scoped Contextual HUD
  function renderTopHUD() {
    const currentDay = ensureDay(activeDate);
    const targets = state.settings.targets || DEFAULT_TARGETS;

    // --- HUD 1: Nutrition & Macros ---
    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    currentDay.meals.forEach((m) => {
      totalKcal += Number(m.kcal || 0);
      totalProtein += Number(m.protein || 0);
      totalCarbs += Number(m.carbs || 0);
      totalFat += Number(m.fat || 0);
    });

    const elKcalCurrent = document.getElementById('hudCaloriesCurrent');
    const elKcalTarget = document.getElementById('hudCaloriesTarget');
    const elKcalBadge = document.getElementById('hudCaloriesRemainingBadge');
    const elKcalBar = document.getElementById('hudCalorieBar');

    if (elKcalCurrent) elKcalCurrent.textContent = Math.round(totalKcal).toLocaleString();
    if (elKcalTarget) elKcalTarget.textContent = targets.calories.toLocaleString();

    const remainingKcal = targets.calories - Math.round(totalKcal);
    if (elKcalBadge) {
      if (remainingKcal >= 0) {
        elKcalBadge.textContent = `${remainingKcal} left`;
        elKcalBadge.className = 'text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-500/30';
      } else {
        elKcalBadge.textContent = `+${Math.abs(remainingKcal)} over`;
        elKcalBadge.className = 'text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-500/30 animate-pulse';
      }
    }

    const kcalPct = Math.min(100, Math.round((totalKcal / (targets.calories || 1)) * 100));
    if (elKcalBar) {
      elKcalBar.style.width = `${kcalPct}%`;
      if (totalKcal > targets.calories) {
        elKcalBar.className = 'h-full bg-gradient-to-r from-amber-500 to-rose-400 transition-all duration-500 ease-out rounded-full shadow-glow-amber';
      } else {
        elKcalBar.className = 'h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-500 ease-out rounded-full shadow-glow-cyan-sm';
      }
    }

    // Protein
    const pCurrent = Math.round(totalProtein * 10) / 10;
    const pPct = Math.min(100, Math.round((pCurrent / (targets.protein || 1)) * 100));
    const elPCur = document.getElementById('hudProteinCurrent');
    const elPTar = document.getElementById('hudProteinTarget');
    const elPPct = document.getElementById('hudProteinPct');
    const elPBar = document.getElementById('hudProteinBar');
    if (elPCur) elPCur.textContent = pCurrent;
    if (elPTar) elPTar.textContent = `${targets.protein}g`;
    if (elPPct) elPPct.textContent = `${pPct}%`;
    if (elPBar) elPBar.style.width = `${pPct}%`;

    // Carbs
    const cCurrent = Math.round(totalCarbs * 10) / 10;
    const cPct = Math.min(100, Math.round((cCurrent / (targets.carbs || 1)) * 100));
    const elCCur = document.getElementById('hudCarbsCurrent');
    const elCTar = document.getElementById('hudCarbsTarget');
    const elCPct = document.getElementById('hudCarbsPct');
    const elCBar = document.getElementById('hudCarbsBar');
    if (elCCur) elCCur.textContent = cCurrent;
    if (elCTar) elCTar.textContent = `${targets.carbs}g`;
    if (elCPct) elCPct.textContent = `${cPct}%`;
    if (elCBar) elCBar.style.width = `${cPct}%`;

    // Fat
    const fCurrent = Math.round(totalFat * 10) / 10;
    const fPct = Math.min(100, Math.round((fCurrent / (targets.fat || 1)) * 100));
    const elFCur = document.getElementById('hudFatCurrent');
    const elFTar = document.getElementById('hudFatTarget');
    const elFPct = document.getElementById('hudFatPct');
    const elFBar = document.getElementById('hudFatBar');
    if (elFCur) elFCur.textContent = fCurrent;
    if (elFTar) elFTar.textContent = `${targets.fat}g`;
    if (elFPct) elFPct.textContent = `${fPct}%`;
    if (elFBar) elFBar.style.width = `${fPct}%`;

    const steps = Number(currentDay.biometrics.steps || 0);

    // --- HUD 2: Training Session Matrix ---
    const activeSplit = currentDay.workouts.activeSplit || 'upper';
    const splitExercises = state.settings.exercises[activeSplit] || DEFAULT_EXERCISES[activeSplit] || [];
    const finishedList = currentDay.workouts.finishedExercises || [];
    const completedCount = splitExercises.filter(ex => finishedList.includes(ex)).length;
    const totalCount = splitExercises.length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    let totalTonnage = 0;
    const exercises = currentDay.workouts.exercises || {};
    for (const ex in exercises) {
      const data = exercises[ex];
      if (Array.isArray(data)) {
        data.forEach(s => {
          if (s.weight && s.reps) totalTonnage += Number(s.weight) * Number(s.reps);
        });
      } else if (typeof data === 'object' && data !== null) {
        const w = Number(data.weight || 0);
        const r = Number(data.reps || 0);
        const s = Number(data.sets || 3);
        if (w > 0 && r > 0 && s > 0) totalTonnage += (w * r * s);
      }
    }

    const splitTitles = {
      upper: 'Upper Body Session',
      lower: 'Lower & Core Session',
      full: 'MED Failsafe Session'
    };

    const elGymTitle = document.getElementById('hudGymActiveSplitTitle');
    const elGymBadge = document.getElementById('hudGymStatusBadge');
    const elGymTonnage = document.getElementById('hudGymTonnageVal');
    const elGymPct = document.getElementById('hudGymProgressPct');
    const elGymBar = document.getElementById('hudGymProgressBar');

    if (elGymTitle) elGymTitle.textContent = splitTitles[activeSplit] || 'Gym Session';
    if (elGymBadge) elGymBadge.textContent = `${completedCount} / ${totalCount} Done`;
    if (elGymTonnage) elGymTonnage.textContent = `${totalTonnage.toLocaleString()} kg`;
    if (elGymPct) elGymPct.textContent = `${progressPct}%`;
    if (elGymBar) elGymBar.style.width = `${progressPct}%`;

    // --- HUD 3: Biometric Baseline ---
    const bio = currentDay.biometrics || {};
    const habits = currentDay.habits || {};

    const elBioWeight = document.getElementById('hudBioWeightDisplay');
    const elBioWaist = document.getElementById('hudBioWaistDisplay');
    const elBioSteps = document.getElementById('hudBioStepsDisplay');
    const elBioHabit = document.getElementById('hudBioHabitBadge');

    if (elBioWeight) elBioWeight.textContent = bio.weight ? `${bio.weight} kg` : '-';
    if (elBioWaist) elBioWaist.textContent = bio.waistBraced ? `${bio.waistBraced} in` : '-';
    if (elBioSteps) elBioSteps.textContent = steps.toLocaleString();
    if (elBioHabit) {
      if (habits.vacuums) {
        elBioHabit.textContent = 'Vacuums: Done';
        elBioHabit.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/30';
      } else {
        elBioHabit.textContent = 'Vacuums: Pending';
        elBioHabit.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
      }
    }
  }

  // 3. Tab 1: Biometrics & Core Habits
  function renderTabBiometrics() {
    const day = ensureDay(activeDate);
    const bio = day.biometrics || {};
    const habits = day.habits || {};
    const targetSteps = (state.settings.targets && state.settings.targets.steps) || 8000;

    // Numeric inputs
    const elWeight = document.getElementById('inputBioWeight');
    const elFat = document.getElementById('inputBioSubcutFat');
    const elWaistB = document.getElementById('inputBioWaistBraced');
    const elWaistR = document.getElementById('inputBioWaistRelaxed');
    const elSteps = document.getElementById('inputBioSteps');

    if (elWeight) elWeight.value = bio.weight !== null ? bio.weight : '';
    if (elFat) elFat.value = bio.subcutaneousFat !== null ? bio.subcutaneousFat : '';
    if (elWaistB) elWaistB.value = bio.waistBraced !== null ? bio.waistBraced : '';
    if (elWaistR) elWaistR.value = bio.waistRelaxed !== null ? bio.waistRelaxed : '';
    if (elSteps) elSteps.value = bio.steps || '';

    // Step Telemetry Card display
    const steps = Number(bio.steps || 0);
    const stepsPct = Math.min(100, Math.round((steps / targetSteps) * 100));
    const rem = targetSteps - steps;

    const elLogged = document.getElementById('bioStepsLoggedDisplay');
    const elGoal = document.getElementById('bioStepsGoalText');
    const elBar = document.getElementById('bioStepsProgressBar');
    const elRem = document.getElementById('bioStepsRemainingBadge');

    if (elLogged) elLogged.textContent = steps.toLocaleString();
    if (elGoal) elGoal.textContent = targetSteps.toLocaleString();
    if (elBar) elBar.style.width = `${stepsPct}%`;
    if (elRem) {
      if (rem <= 0) {
        elRem.textContent = `Goal Met! (+${Math.abs(rem).toLocaleString()})`;
        elRem.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-glow-emerald';
      } else {
        elRem.textContent = `${rem.toLocaleString()} steps to goal`;
        elRem.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-fuchsia-300';
      }
    }

    // Weight trend
    updateWeightTrendDisplay(bio.weight);

    // Habit toggle (Vacuums)
    const vacCheck = document.getElementById('habitVacuums');
    if (vacCheck) vacCheck.checked = !!habits.vacuums;

    updateHabitsScoreUI(habits);
  }

  function updateWeightTrendDisplay(currentWeight) {
    const trendEl = document.getElementById('bioWeightTrend');
    if (!trendEl) return;

    if (!currentWeight) {
      trendEl.textContent = 'Ref: Baseline (65.0 kg)';
      return;
    }

    // Look for previous day with weight
    const dates = Object.keys(state.days).sort();
    const curIdx = dates.indexOf(activeDate);
    let prevWeight = null;
    let prevDate = null;

    for (let i = curIdx - 1; i >= 0; i--) {
      const d = dates[i];
      if (state.days[d]?.biometrics?.weight) {
        prevWeight = Number(state.days[d].biometrics.weight);
        prevDate = d;
        break;
      }
    }

    if (prevWeight !== null) {
      const diff = Math.round((Number(currentWeight) - prevWeight) * 10) / 10;
      const sign = diff > 0 ? `+${diff}` : `${diff}`;
      trendEl.textContent = `Prev (${prevDate.slice(5)}): ${prevWeight}kg (${sign} kg)`;
      trendEl.className = diff <= 0 ? 'text-[10px] font-mono text-emerald-400 mt-1' : 'text-[10px] font-mono text-amber-400 mt-1';
    } else {
      trendEl.textContent = 'Ref: Target baseline 65.0 kg';
      trendEl.className = 'text-[10px] font-mono text-slate-500 mt-1';
    }
  }

  function updateHabitsScoreUI(habits) {
    const scoreBadge = document.getElementById('habitsScoreBadge');
    if (!scoreBadge) return;

    if (habits.vacuums) {
      scoreBadge.textContent = '1/1 Locked (Done)';
      scoreBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-400 shadow-glow-emerald';
    } else {
      scoreBadge.textContent = 'Pending';
      scoreBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800';
    }
  }

  // 4. Tab 2: Clockwork Nutrition (Presets & Feed)
  function renderTabNutrition() {
    renderPresetsList();
    renderLoggedMealsFeed();
  }

  function getFrequentMeals(limit = 6) {
    if (!state.days) return [];

    const mealMap = new Map();

    Object.keys(state.days).forEach((dateKey) => {
      const day = state.days[dateKey];
      if (!day || !Array.isArray(day.meals)) return;

      day.meals.forEach((meal) => {
        if (!meal || !meal.name) return;
        const rawName = meal.name.trim();
        if (!rawName) return;

        const normKey = rawName.toLowerCase();
        const mealTimestamp = dateKey + ' ' + (meal.time || '00:00');

        if (!mealMap.has(normKey)) {
          mealMap.set(normKey, {
            name: rawName,
            count: 0,
            kcal: Math.round(Number(meal.kcal || 0)),
            protein: Math.round(Number(meal.protein || 0)),
            carbs: Math.round(Number(meal.carbs || 0)),
            fat: Math.round(Number(meal.fat || 0)),
            lastLogged: mealTimestamp
          });
        }

        const entry = mealMap.get(normKey);
        entry.count += 1;
        if (mealTimestamp >= entry.lastLogged) {
          entry.name = rawName;
          entry.kcal = Math.round(Number(meal.kcal || 0));
          entry.protein = Math.round(Number(meal.protein || 0));
          entry.carbs = Math.round(Number(meal.carbs || 0));
          entry.fat = Math.round(Number(meal.fat || 0));
          entry.lastLogged = mealTimestamp;
        }
      });
    });

    return Array.from(mealMap.values())
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastLogged.localeCompare(a.lastLogged);
      })
      .slice(0, limit);
  }

  function renderPresetsList() {
    const container = document.getElementById('presetsContainer');
    if (!container) return;

    const frequentMeals = getFrequentMeals(6);
    container.innerHTML = '';

    if (frequentMeals.length === 0) {
      container.innerHTML = `
        <div class="p-3.5 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 text-center space-y-1 font-mono">
          <div class="flex items-center justify-center space-x-1.5 text-slate-400 text-xs">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-cyan-400"></i>
            <span class="font-bold text-slate-300">No Frequently Logged Meals Yet</span>
          </div>
          <p class="text-[10px] text-slate-500 leading-relaxed max-w-sm mx-auto">
            Log your meals via the Quick Macro Logger or Photo AI below. Your most frequent meals will appear here automatically for 1-tap re-logging!
          </p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    frequentMeals.forEach((meal) => {
      const card = document.createElement('div');
      card.className = 'p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition flex items-center justify-between group cursor-pointer active:scale-[0.99]';
      
      const badgeText = meal.count > 1 ? `Logged ${meal.count}×` : 'Logged 1×';

      card.innerHTML = `
        <div class="flex-1 mr-2">
          <div class="flex items-center space-x-1.5 mb-1">
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">${badgeText}</span>
            <span class="text-xs font-semibold text-slate-200 line-clamp-1">${escapeHtml(meal.name)}</span>
          </div>
          <div class="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
            <span class="text-cyan-400 font-bold">${meal.kcal} kcal</span>
            <span>&bull;</span>
            <span class="text-sky-300 font-semibold">${meal.protein}g P</span>
            <span>&bull;</span>
            <span class="text-emerald-300">${meal.carbs}g C</span>
            <span>&bull;</span>
            <span class="text-amber-300">${meal.fat}g F</span>
          </div>
        </div>
        <button type="button" class="preset-log-btn px-2.5 py-1.5 rounded-md bg-cyan-950/90 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 font-mono text-xs font-bold transition flex items-center space-x-1 shadow-glow-cyan-sm">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>LOG</span>
        </button>
      `;

      card.addEventListener('click', () => {
        logFrequentMeal(meal);
      });

      container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  function logFrequentMeal(meal) {
    const day = ensureDay(activeDate);
    const newMeal = {
      id: 'frequent-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      time: formatTimeNow(),
      name: meal.name,
      kcal: Number(meal.kcal || 0),
      protein: Number(meal.protein || 0),
      carbs: Number(meal.carbs || 0),
      fat: Number(meal.fat || 0),
      source: 'frequent'
    };

    day.meals.push(newMeal);
    saveState();
    renderTopHUD();
    renderLoggedMealsFeed();
    renderPresetsList();
    showToast(`Logged: ${meal.name.split(' - ')[0]} (+${meal.protein}g P)`, 'check-circle');
  }

  function logPresetMeal(preset) {
    logFrequentMeal(preset);
  }

  function renderLoggedMealsFeed() {
    const list = document.getElementById('loggedMealsList');
    const placeholder = document.getElementById('noMealsPlaceholder');
    const countBadge = document.getElementById('loggedMealsCountBadge');
    if (!list) return;

    const day = ensureDay(activeDate);
    list.innerHTML = '';

    if (!day.meals || day.meals.length === 0) {
      if (placeholder) placeholder.classList.remove('hidden');
      if (countBadge) countBadge.textContent = '0 items';
      return;
    }

    if (placeholder) placeholder.classList.add('hidden');
    if (countBadge) countBadge.textContent = `${day.meals.length} item${day.meals.length > 1 ? 's' : ''}`;

    day.meals.forEach((meal, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex items-center justify-between group';

      const sourceBadge = meal.source === 'ai' 
        ? '<span class="text-[9px] font-mono px-1 rounded bg-fuchsia-950 text-fuchsia-300 border border-fuchsia-500/30">AI VISION</span>'
        : meal.source === 'preset'
        ? '<span class="text-[9px] font-mono px-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">PRESET</span>'
        : '<span class="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-300">CUSTOM</span>';

      itemEl.innerHTML = `
        <div class="flex-1 mr-2">
          <div class="flex items-center space-x-1.5 mb-1">
            <span class="text-[10px] font-mono text-slate-400">${escapeHtml(meal.time || '12:00 PM')}</span>
            ${sourceBadge}
            <span class="text-xs font-semibold text-slate-200 line-clamp-1">${escapeHtml(meal.name)}</span>
          </div>
          <div class="flex items-center space-x-2 text-[10px] font-mono">
            <span class="text-cyan-400 font-bold">${meal.kcal} kcal</span>
            <span class="text-slate-600">&bull;</span>
            <span class="text-sky-300 font-semibold">${meal.protein}g P</span>
            <span class="text-slate-600">&bull;</span>
            <span class="text-emerald-300">${meal.carbs}g C</span>
            <span class="text-slate-600">&bull;</span>
            <span class="text-amber-300">${meal.fat}g F</span>
          </div>
        </div>
        <button type="button" class="delete-meal-btn text-slate-500 hover:text-rose-400 p-1.5 rounded hover:bg-slate-900 transition" data-id="${meal.id}" title="Delete meal">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      `;

      itemEl.querySelector('.delete-meal-btn').addEventListener('click', () => {
        deleteMeal(meal.id);
      });

      list.appendChild(itemEl);
    });

    if (window.lucide) lucide.createIcons();
  }

  function deleteMeal(mealId) {
    const day = ensureDay(activeDate);
    const idx = day.meals.findIndex((m) => m.id === mealId);
    if (idx !== -1) {
      const removed = day.meals.splice(idx, 1)[0];
      saveState();
      renderTopHUD();
      renderLoggedMealsFeed();
      renderPresetsList();
      showToast(`Removed: ${removed.name}`, 'trash');
    }
  }

  // 5. Tab 3: 10:15 AM Gym Logger (Progressive Overload & Planned vs Completed)
  function renderTabGym() {
    const day = ensureDay(activeDate);
    const activeSplit = day.workouts.activeSplit || 'upper';
    day.workouts.finishedExercises = day.workouts.finishedExercises || [];

    // Highlight Split Selector Buttons
    document.querySelectorAll('.split-select-btn').forEach((btn) => {
      const split = btn.getAttribute('data-split');
      if (split === activeSplit) {
        btn.className = 'split-select-btn py-1.5 px-2 rounded font-semibold text-center transition bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm';
      } else {
        btn.className = 'split-select-btn py-1.5 px-2 rounded font-semibold text-center transition text-slate-400 hover:text-slate-200 hover:bg-slate-900';
      }
    });

    const plannedContainer = document.getElementById('plannedExercisesContainer');
    const completedContainer = document.getElementById('completedExercisesContainer');
    const completedSection = document.getElementById('completedExercisesSection');
    const plannedDonePlaceholder = document.getElementById('plannedAllDonePlaceholder');
    const completeBanner = document.getElementById('workoutCompleteBanner');

    if (plannedContainer) plannedContainer.innerHTML = '';
    if (completedContainer) completedContainer.innerHTML = '';

    const splitExercises = state.settings.exercises[activeSplit] || DEFAULT_EXERCISES[activeSplit] || [];
    const finishedSet = new Set(day.workouts.finishedExercises);

    const plannedList = splitExercises.filter((ex) => !finishedSet.has(ex));
    const completedList = splitExercises.filter((ex) => finishedSet.has(ex));

    let totalTonnage = 0;

    // --- RENDER PLANNED EXERCISES ---
    plannedList.forEach((exName) => {
      const topSetInfo = getHistoricalTopSet(exName, activeDate);

      // Normalize exercise data to 3-box format: { weight, reps, sets }
      if (!day.workouts.exercises[exName] || Array.isArray(day.workouts.exercises[exName])) {
        const legacyArr = Array.isArray(day.workouts.exercises[exName]) ? day.workouts.exercises[exName] : [];
        const first = legacyArr[0] || {};
        day.workouts.exercises[exName] = {
          weight: first.weight !== undefined ? first.weight : '',
          reps: first.reps !== undefined ? first.reps : '',
          sets: legacyArr.length > 0 ? legacyArr.length : 3
        };
      }

      const exData = day.workouts.exercises[exName];
      const wVal = Number(exData.weight || 0);
      const rVal = Number(exData.reps || 0);
      const sVal = Number(exData.sets || 3);
      const exVolume = (wVal > 0 && rVal > 0 && sVal > 0) ? (wVal * rVal * sVal) : 0;
      totalTonnage += exVolume;

      const card = document.createElement('div');
      card.className = 'bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5';

      const topSetBadge = topSetInfo
        ? `<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1">
             <i data-lucide="zap" class="w-3 h-3 text-cyan-400"></i>
             <span>Last: <strong>${topSetInfo.weight}kg &times; ${topSetInfo.reps} reps (${topSetInfo.sets} sets)</strong></span>
           </span>`
        : `<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-500 border border-slate-800">
             Baseline / New
           </span>`;

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="w-1.5 h-3.5 bg-cyan-400 rounded-full"></span>
            <h3 class="text-xs font-bold font-mono text-slate-100">${escapeHtml(exName)}</h3>
          </div>
          <div class="text-[10px] font-mono text-slate-400">
            Vol: <span class="text-cyan-300 font-semibold">${exVolume.toLocaleString()} kg</span>
          </div>
        </div>

        <div class="flex items-center justify-between">
          ${topSetBadge}
        </div>

        <!-- 3-Box Single-Line Input Row: Weight | Reps | Sets -->
        <div class="grid grid-cols-3 gap-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800">
          <div>
            <label class="block text-[9px] font-mono text-slate-400 uppercase text-center mb-0.5">Weight (kg)</label>
            <input type="number" step="0.5" class="ex-weight-input w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-400 rounded px-2 py-1.5 text-xs font-mono text-cyan-300 text-center font-bold focus:outline-none transition"
              placeholder="kg" value="${exData.weight !== '' ? exData.weight : ''}">
          </div>
          <div>
            <label class="block text-[9px] font-mono text-slate-400 uppercase text-center mb-0.5">Reps / Set</label>
            <input type="number" step="1" class="ex-reps-input w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-400 rounded px-2 py-1.5 text-xs font-mono text-cyan-300 text-center font-bold focus:outline-none transition"
              placeholder="reps" value="${exData.reps !== '' ? exData.reps : ''}">
          </div>
          <div>
            <label class="block text-[9px] font-mono text-slate-400 uppercase text-center mb-0.5">Total Sets</label>
            <input type="number" step="1" min="1" class="ex-sets-input w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-400 rounded px-2 py-1.5 text-xs font-mono text-cyan-300 text-center font-bold focus:outline-none transition"
              placeholder="3" value="${exData.sets !== '' ? exData.sets : 3}">
          </div>
        </div>

        <!-- Finish Exercise Action Button -->
        <button type="button" class="finish-movement-btn w-full mt-1 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 font-mono font-semibold text-xs uppercase flex items-center justify-center space-x-1.5 transition active:scale-95 shadow-glow-emerald" data-ex="${escapeHtml(exName)}">
          <i data-lucide="check-check" class="w-3.5 h-3.5 text-emerald-400"></i>
          <span>Finish Movement</span>
        </button>
      `;

      const weightInput = card.querySelector('.ex-weight-input');
      const repsInput = card.querySelector('.ex-reps-input');
      const setsInput = card.querySelector('.ex-sets-input');

      weightInput.addEventListener('input', (e) => {
        exData.weight = e.target.value;
        saveState();
        updateTonnageBadge();
      });

      repsInput.addEventListener('input', (e) => {
        exData.reps = e.target.value;
        saveState();
        updateTonnageBadge();
      });

      setsInput.addEventListener('input', (e) => {
        exData.sets = Number(e.target.value || 3);
        saveState();
        updateTonnageBadge();
      });

      card.querySelector('.finish-movement-btn').addEventListener('click', () => {
        finishExercise(exName);
      });

      if (plannedContainer) plannedContainer.appendChild(card);
    });

    // --- RENDER COMPLETED EXERCISES ---
    completedList.forEach((exName) => {
      const exData = day.workouts.exercises[exName] || { weight: '', reps: '', sets: 3 };
      let w = 0;
      let r = 0;
      let s = 3;

      if (Array.isArray(exData)) {
        const first = exData[0] || {};
        w = Number(first.weight || 0);
        r = Number(first.reps || 0);
        s = exData.length || 3;
      } else {
        w = Number(exData.weight || 0);
        r = Number(exData.reps || 0);
        s = Number(exData.sets || 3);
      }

      const exVolume = (w > 0 && r > 0 && s > 0) ? (w * r * s) : 0;
      totalTonnage += exVolume;

      const card = document.createElement('div');
      card.className = 'bg-gradient-to-r from-slate-900/90 via-slate-900 to-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 space-y-2';

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
            <h4 class="text-xs font-bold font-mono text-emerald-300">${escapeHtml(exName)}</h4>
          </div>
          <button type="button" class="reopen-movement-btn px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 border border-slate-700 flex items-center space-x-1 transition active:scale-95" data-ex="${escapeHtml(exName)}" title="Reopen this movement to edit">
            <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
            <span>Reopen</span>
          </button>
        </div>
        <div class="flex items-center justify-between text-[11px] font-mono border-t border-slate-800/80 pt-1.5">
          <span class="text-emerald-300 font-bold">${w > 0 ? `${w}kg &times; ${r} reps (${s} sets)` : 'Completed'}</span>
          <span class="text-cyan-300 font-semibold">${exVolume.toLocaleString()} kg Vol</span>
        </div>
      `;

      card.querySelector('.reopen-movement-btn').addEventListener('click', () => {
        reopenExercise(exName);
      });

      if (completedContainer) completedContainer.appendChild(card);
    });

    // Update section badges & visibility
    const plannedBadge = document.getElementById('plannedExercisesBadge');
    const completedBadge = document.getElementById('completedExercisesBadge');

    if (plannedBadge) plannedBadge.textContent = `${plannedList.length} Pending`;
    if (completedBadge) completedBadge.textContent = `${completedList.length} Done`;

    if (plannedDonePlaceholder) {
      plannedDonePlaceholder.classList.toggle('hidden', plannedList.length > 0 || splitExercises.length === 0);
    }
    if (completedSection) {
      completedSection.classList.toggle('hidden', completedList.length === 0);
    }
    if (completeBanner) {
      completeBanner.classList.toggle('hidden', !(plannedList.length === 0 && completedList.length > 0));
    }

    // Update Tonnage Badge
    const tonnageBadge = document.getElementById('gymTonnageBadge');
    if (tonnageBadge) {
      tonnageBadge.textContent = `${totalTonnage.toLocaleString()} kg Tonnage`;
    }

    renderTopHUD();

    if (window.lucide) lucide.createIcons();
  }

  function finishExercise(exName) {
    const day = ensureDay(activeDate);
    day.workouts.finishedExercises = day.workouts.finishedExercises || [];
    if (!day.workouts.finishedExercises.includes(exName)) {
      day.workouts.finishedExercises.push(exName);
    }

    saveState();
    renderTabGym();
    showToast(`${exName} Completed!`, 'check-circle');
  }

  function reopenExercise(exName) {
    const day = ensureDay(activeDate);
    day.workouts.finishedExercises = day.workouts.finishedExercises || [];
    day.workouts.finishedExercises = day.workouts.finishedExercises.filter((name) => name !== exName);
    saveState();
    renderTabGym();
    showToast(`${exName} Reopened`, 'rotate-ccw');
  }

  function updateTonnageBadge() {
    const day = ensureDay(activeDate);
    let totalTonnage = 0;
    const exercises = day.workouts.exercises || {};
    for (const ex in exercises) {
      const data = exercises[ex];
      if (Array.isArray(data)) {
        data.forEach((s) => {
          if (s.weight && s.reps) totalTonnage += Number(s.weight) * Number(s.reps);
        });
      } else if (typeof data === 'object' && data !== null) {
        const w = Number(data.weight || 0);
        const r = Number(data.reps || 0);
        const s = Number(data.sets || 3);
        if (w > 0 && r > 0 && s > 0) totalTonnage += (w * r * s);
      }
    }
    const tonnageBadge = document.getElementById('gymTonnageBadge');
    if (tonnageBadge) {
      tonnageBadge.textContent = `${totalTonnage.toLocaleString()} kg Tonnage`;
    }
    renderTopHUD();
  }

  // Query historical top set across all sessions
  function getHistoricalTopSet(exerciseName, excludeDate) {
    let topWeight = -1;
    let topReps = -1;
    let topSets = -1;
    let topDate = null;

    const dates = Object.keys(state.days).sort();
    for (const d of dates) {
      if (d === excludeDate) continue;
      const dayData = state.days[d];
      if (dayData?.workouts?.exercises && dayData.workouts.exercises[exerciseName]) {
        const exData = dayData.workouts.exercises[exerciseName];
        if (Array.isArray(exData)) {
          exData.forEach((s) => {
            const w = Number(s.weight || 0);
            const r = Number(s.reps || 0);
            if (w > topWeight || (w === topWeight && r > topReps)) {
              topWeight = w;
              topReps = r;
              topSets = exData.length;
              topDate = d;
            }
          });
        } else if (typeof exData === 'object' && exData !== null) {
          const w = Number(exData.weight || 0);
          const r = Number(exData.reps || 0);
          const s = Number(exData.sets || 3);
          if (w > topWeight || (w === topWeight && r > topReps)) {
            topWeight = w;
            topReps = r;
            topSets = s;
            topDate = d;
          }
        }
      }
    }

    if (topWeight > 0) {
      return { weight: topWeight, reps: topReps, sets: topSets, date: topDate };
    }
    return null;
  }

  // 6. Tab 4: JARVIS Uplink & Settings
  function renderTabSettings() {
    const targets = state.settings.targets || DEFAULT_TARGETS;

    document.getElementById('settingGasUrl').value = state.settings.gasWebhookUrl || '';
    document.getElementById('settingGeminiApiKey').value = state.settings.geminiApiKey || '';
    document.getElementById('settingGeminiModel').value = state.settings.geminiModel || 'gemini-2.5-flash';

    document.getElementById('settingTargetCalories').value = targets.calories;
    document.getElementById('settingTargetProtein').value = targets.protein;
    document.getElementById('settingTargetCarbs').value = targets.carbs;
    document.getElementById('settingTargetFat').value = targets.fat;
    document.getElementById('settingTargetSteps').value = targets.steps;
  }

  // --- 7-DAY TELEMETRY COMPILER ---

  function compile7DayTelemetry() {
    // Generate the 7 consecutive dates ending on activeDate
    const dateList = [];
    const baseDate = new Date(activeDate + 'T12:00:00');
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dateList.push(`${y}-${m}-${day}`);
    }

    const startDate = dateList[0];
    const endDate = dateList[dateList.length - 1];

    let totalWeight = 0;
    let weightCount = 0;
    let totalSteps = 0;
    let stepsCount = 0;
    let totalKcal = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let daysWithMeals = 0;

    let vacuumsDone = 0;
    let cookOilDone = 0;
    let cokeZeroDone = 0;

    let totalWeekTonnage = 0;
    const workoutSummaries = [];

    const tableRows = [];

    dateList.forEach((dStr) => {
      const day = state.days[dStr] || {
        biometrics: { weight: null, subcutaneousFat: null, waistBraced: null, waistRelaxed: null, steps: 0 },
        habits: { vacuums: false, cookOil: false, cokeZero: false },
        meals: [],
        workouts: { activeSplit: 'rest', exercises: {} }
      };

      const bio = day.biometrics || {};
      const habits = day.habits || {};
      const meals = day.meals || [];
      const workouts = day.workouts || {};

      // Biometrics
      if (bio.weight) {
        totalWeight += Number(bio.weight);
        weightCount++;
      }
      if (bio.steps) {
        totalSteps += Number(bio.steps);
        stepsCount++;
      }

      // Habits
      if (habits.vacuums) vacuumsDone++;
      if (habits.cookOil) cookOilDone++;
      if (habits.cokeZero) cokeZeroDone++;

      // Nutrition
      let dayKcal = 0, dayP = 0, dayC = 0, dayF = 0;
      meals.forEach((m) => {
        dayKcal += Number(m.kcal || 0);
        dayP += Number(m.protein || 0);
        dayC += Number(m.carbs || 0);
        dayF += Number(m.fat || 0);
      });

      if (meals.length > 0) {
        totalKcal += dayKcal;
        totalProtein += dayP;
        totalCarbs += dayC;
        totalFat += dayF;
        daysWithMeals++;
      }

      // Workouts
      let dayTonnage = 0;
      const exTops = [];
      const exMap = workouts.exercises || {};
      for (const ex in exMap) {
        if (Array.isArray(exMap[ex])) {
          let topW = 0, topR = 0;
          exMap[ex].forEach((s) => {
            const w = Number(s.weight || 0);
            const r = Number(s.reps || 0);
            dayTonnage += (w * r);
            if (w > topW) { topW = w; topR = r; }
          });
          if (topW > 0) {
            exTops.push(`${ex}: ${topW}kgx${topR}`);
          }
        }
      }
      totalWeekTonnage += dayTonnage;
      if (dayTonnage > 0) {
        workoutSummaries.push(`- **${dStr} (${workouts.activeSplit || 'Gym'})**: ${dayTonnage.toLocaleString()} kg | Top Lifts: ${exTops.slice(0, 3).join(', ')}`);
      }

      // Row formatting
      tableRows.push(`| ${dStr} | ${bio.weight || '-'} | ${bio.subcutaneousFat || '-'} | ${bio.waistBraced || '-'} | ${bio.waistRelaxed || '-'} | ${bio.steps || 0} | ${Math.round(dayKcal)} | ${Math.round(dayP)} | ${Math.round(dayC)} | ${Math.round(dayF)} | ${habits.vacuums ? 'YES' : 'NO'} |`);
    });

    const avgWeight = weightCount > 0 ? (totalWeight / weightCount).toFixed(1) : 'N/A';
    const avgSteps = stepsCount > 0 ? Math.round(totalSteps / 7) : 0;
    const avgKcal = daysWithMeals > 0 ? Math.round(totalKcal / 7) : 0;
    const avgProtein = daysWithMeals > 0 ? Math.round(totalProtein / 7) : 0;
    const avgCarbs = daysWithMeals > 0 ? Math.round(totalCarbs / 7) : 0;
    const avgFat = daysWithMeals > 0 ? Math.round(totalFat / 7) : 0;

    const targets = state.settings.targets || DEFAULT_TARGETS;

    const markdown = `# PROJECT TAHITI v2.3 // 7-DAY TELEMETRY UPLINK
**Subject:** Udit Khot | Body Recomposition & Hypertrophy Matrix
**Window:** ${startDate} to ${endDate} (7 Days)
**Timestamp:** ${new Date().toISOString()}

---

## 1. 7-Day Macro Averages vs Targets
- **Target:** ${targets.calories} kcal | ${targets.protein}g Protein | ${targets.carbs}g Carbs | ${targets.fat}g Fat | ${targets.steps} Steps
- **Actual (7d Avg):** ${avgKcal} kcal | ${avgProtein}g Protein | ${avgCarbs}g Carbs | ${avgFat}g Fat | ${avgSteps} Steps
- **Caloric Delta:** ${avgKcal - targets.calories > 0 ? '+' : ''}${avgKcal - targets.calories} kcal/day
- **Protein Delta:** ${avgProtein - targets.protein > 0 ? '+' : ''}${avgProtein - targets.protein} g/day

## 2. Core Habit Adherence
- **Stomach Vacuums (4x20s):** ${vacuumsDone}/7 (${Math.round((vacuumsDone / 7) * 100)}%)
- **Average Morning Fasted Weight:** ${avgWeight} kg

## 3. Daily Biometrics & Nutrition Matrix
| Date | Weight (kg) | Subcut (kg) | Waist Braced (in) | Waist Relaxed (in) | Steps | Kcal | P (g) | C (g) | F (g) | Vacuums |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${tableRows.join('\n')}

## 4. Progressive Overload & Training Volume
- **Total 7-Day Tonnage:** ${totalWeekTonnage.toLocaleString()} kg
${workoutSummaries.length > 0 ? workoutSummaries.join('\n') : '- No gym sessions recorded in this 7-day window.'}

---

## 5. Instructions for Gemini Coach
Analyze the 7-day telemetry data above:
1. Evaluate rate of fat loss vs muscle retention based on weight trend, waist braced/relaxed changes, and daily protein intake.
2. Review progressive overload consistency in the recorded gym sessions.
3. Suggest 3 high-impact micro-adjustments for next week's macro distribution or training split to break through plateaus.`;

    return markdown;
  }

  // --- GEMINI VISION AI ENGINE ---

  async function executeAiAnalysis() {
    const apiKey = state.settings.geminiApiKey || '';
    if (!apiKey) {
      alert('Gemini API Key missing! Please enter your key in Tab 4 (Settings) or enter it now.');
      switchTab('tabSettings');
      return;
    }

    const model = state.settings.geminiModel || 'gemini-2.5-flash';
    const textDesc = document.getElementById('aiTextDescription').value.trim();

    if (!aiImageBase64 && !textDesc) {
      alert('Please provide either a meal snapshot photo or a description of the meal.');
      return;
    }

    const loadingIndicator = document.getElementById('aiLoadingIndicator');
    const resultCard = document.getElementById('aiResultCard');
    const runBtn = document.getElementById('runAiAnalysisBtn');

    loadingIndicator.classList.remove('hidden');
    resultCard.classList.add('hidden');
    runBtn.disabled = true;

    try {
      const parts = [];

      // Add image if attached
      if (aiImageBase64) {
        parts.push({
          inlineData: {
            mimeType: aiImageMime || 'image/jpeg',
            data: aiImageBase64
          }
        });
      }

      // Prompt
      const systemPrompt = `You are JARVIS, an expert precision fitness and nutritional telemetry AI analyzing meals for body recomposition.
Analyze this meal (from the provided image and/or user notes) with clinical accuracy, especially calibrated for Indian home cooking, gym diets, and body recomposition.
User meal notes: "${textDesc || 'Visual meal identification only'}".

You MUST return a STRICT JSON object only (no markdown, no backticks, no conversational text) matching this schema:
{
  "name": "Concise Descriptive Meal Name (e.g. 150g Grilled Chicken Breast + 2 Whole Wheat Phulkas)",
  "kcal": 420,
  "protein": 45,
  "carbs": 38,
  "fat": 12
}
Estimate realistic portion sizes and account for standard cooking oils. All macronutrient values MUST be valid numbers.`;

      parts.push({ text: systemPrompt });

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error('Gemini returned an empty response.');
      }

      // Parse JSON from response (handling optional ```json wrappers)
      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);

      // Populate preview card
      document.getElementById('aiResultName').value = parsed.name || 'AI Analyzed Meal';
      document.getElementById('aiResultKcal').value = Math.round(Number(parsed.kcal || 0));
      document.getElementById('aiResultProtein').value = Math.round(Number(parsed.protein || 0));
      document.getElementById('aiResultCarbs').value = Math.round(Number(parsed.carbs || 0));
      document.getElementById('aiResultFat').value = Math.round(Number(parsed.fat || 0));

      resultCard.classList.remove('hidden');
      showToast('JARVIS Telemetry Analysis Complete', 'sparkles');

    } catch (err) {
      console.error('[TAHITI] AI Analysis failed:', err);
      alert(`JARVIS AI Analysis failed: ${err.message}\n\nPlease check your API key, internet connection, or model name.`);
    } finally {
      loadingIndicator.classList.add('hidden');
      runBtn.disabled = false;
      if (window.lucide) lucide.createIcons();
    }
  }

  // --- INLINE AI MACRO ESTIMATOR (CUSTOM MEAL) ---

  async function estimateCustomMealWithAi() {
    const nameInput = document.getElementById('quickMacroName');
    const desc = nameInput ? nameInput.value.trim() : '';
    const statusEl = document.getElementById('quickAiEstimateStatus');
    const btnText = document.getElementById('quickAiBtnText');
    const aiBtn = document.getElementById('quickAiEstimateBtn');

    if (!desc) {
      if (statusEl) {
        statusEl.textContent = 'Please enter meal description first.';
        statusEl.className = 'text-[10px] font-mono text-amber-400';
        statusEl.classList.remove('hidden');
      }
      showToast('Enter meal description first', 'alert-circle');
      nameInput?.focus();
      return;
    }

    const apiKey = state.settings.geminiApiKey;
    if (!apiKey) {
      alert('Gemini API key is required for AI estimation. Please add your key in Settings.');
      switchTab('tabSettings');
      return;
    }

    const model = state.settings.geminiModel || 'gemini-2.5-flash';

    try {
      if (aiBtn) aiBtn.disabled = true;
      if (btnText) btnText.textContent = 'Estimating...';
      if (statusEl) {
        statusEl.textContent = 'Consulting JARVIS AI...';
        statusEl.className = 'text-[10px] font-mono text-cyan-400';
        statusEl.classList.remove('hidden');
      }

      const prompt = `You are JARVIS, an expert precision fitness and nutritional telemetry AI.
Analyze this meal description with clinical accuracy for body recomposition, calibrated for Indian home cooking, gym diets, and macros.
Meal description: "${desc}".

Return ONLY a strict JSON object (no markdown, no backticks, no comments) matching:
{
  "name": "Concise Descriptive Meal Name",
  "kcal": 450,
  "protein": 35.0,
  "carbs": 42.0,
  "fat": 14.0
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${response.status}`);
      }

      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Gemini');

      let cleaned = rawText.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);

      if (parsed.name && nameInput) nameInput.value = parsed.name;
      const elKcal = document.getElementById('quickMacroKcal');
      const elProt = document.getElementById('quickMacroProtein');
      const elCarbs = document.getElementById('quickMacroCarbs');
      const elFat = document.getElementById('quickMacroFat');

      if (elKcal) elKcal.value = Math.round(Number(parsed.kcal || 0));
      if (elProt) elProt.value = Math.round(Number(parsed.protein || 0) * 10) / 10;
      if (elCarbs) elCarbs.value = Math.round(Number(parsed.carbs || 0) * 10) / 10;
      if (elFat) elFat.value = Math.round(Number(parsed.fat || 0) * 10) / 10;

      if (statusEl) {
        statusEl.textContent = `Estimated: ${elKcal.value} kcal | ${elProt.value}g P | ${elCarbs.value}g C | ${elFat.value}g F`;
        statusEl.className = 'text-[10px] font-mono text-emerald-400';
        statusEl.classList.remove('hidden');
      }
      showToast('AI Macro Estimation Ready', 'sparkles');

    } catch (err) {
      console.error('[TAHITI] Quick AI estimate failed:', err);
      if (statusEl) {
        statusEl.textContent = `AI estimation error: ${err.message}`;
        statusEl.className = 'text-[10px] font-mono text-rose-400';
        statusEl.classList.remove('hidden');
      }
      showToast('AI Estimation Failed', 'alert-circle');
    } finally {
      if (aiBtn) aiBtn.disabled = false;
      if (btnText) btnText.textContent = 'Ask AI';
      if (window.lucide) lucide.createIcons();
    }
  }

  // --- GOOGLE APPS SCRIPT WEBHOOK SYNC ---

  async function pullFromGoogleSheets(silent = false) {
    const webhookUrl = state.settings.gasWebhookUrl;
    if (!webhookUrl) {
      if (!silent) {
        alert('Google Apps Script Webhook URL is not configured. Please paste your Web App deployment URL in Settings.');
        switchTab('tabSettings');
      }
      return;
    }

    setSyncLoading(true, 'PULLING');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const url = webhookUrl.includes('?') ? `${webhookUrl}&action=fetchAll` : `${webhookUrl}?action=fetchAll`;
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = await response.json();
      if (res.status === 'success' && res.days && typeof res.days === 'object') {
        for (const [d, cloudDay] of Object.entries(res.days)) {
          if (!state.days[d]) {
            state.days[d] = cloudDay;
          } else {
            const localDay = state.days[d];
            if (cloudDay.biometrics) {
              localDay.biometrics = localDay.biometrics || {};
              for (const k in cloudDay.biometrics) {
                if (cloudDay.biometrics[k] !== null && cloudDay.biometrics[k] !== undefined && cloudDay.biometrics[k] !== '') {
                  if (localDay.biometrics[k] === null || localDay.biometrics[k] === undefined || localDay.biometrics[k] === '') {
                    localDay.biometrics[k] = cloudDay.biometrics[k];
                  }
                }
              }
            }
            if (Array.isArray(cloudDay.meals) && cloudDay.meals.length > 0) {
              localDay.meals = localDay.meals || [];
              const existingIds = new Set(localDay.meals.map((m) => m.id));
              cloudDay.meals.forEach((cm) => {
                if (!existingIds.has(cm.id)) {
                  localDay.meals.push(cm);
                }
              });
            }
            if (cloudDay.workouts && cloudDay.workouts.splits) {
              localDay.workouts = localDay.workouts || { activeSplit: 'upper', exercises: {}, finishedExercises: [] };
              localDay.workouts.exercises = localDay.workouts.exercises || {};
              localDay.workouts.finishedExercises = localDay.workouts.finishedExercises || [];
              for (const sKey in cloudDay.workouts.splits) {
                const cloudExMap = cloudDay.workouts.splits[sKey];
                for (const exName in cloudExMap) {
                  if (!localDay.workouts.exercises[exName]) {
                    const cVal = cloudExMap[exName];
                    if (Array.isArray(cVal)) {
                      localDay.workouts.exercises[exName] = {
                        weight: cVal[0]?.weight || '',
                        reps: cVal[0]?.reps || '',
                        sets: cVal.length || 3
                      };
                    } else {
                      localDay.workouts.exercises[exName] = cVal;
                    }
                  }
                  if (!localDay.workouts.finishedExercises.includes(exName)) {
                    localDay.workouts.finishedExercises.push(exName);
                  }
                }
              }
            }
            localDay.synced = true;
          }
        }
        ensureDay(activeDate).synced = true;
        saveState(true);
        refreshAllUI();
        if (!silent) {
          showToast(`Cloud Pull Complete: Synced ${Object.keys(res.days).length} days`, 'cloud-lightning');
        }
      } else {
        if (!silent) showToast('Cloud is up-to-date', 'cloud');
      }
    } catch (err) {
      console.warn('[TAHITI] Pull from cloud warning:', err);
      if (!silent) {
        showToast('Pull failed or offline', 'cloud-off');
      }
    } finally {
      clearTimeout(timeoutId);
      setSyncLoading(false);
      updateSyncStatusUI();
    }
  }

  async function syncToGoogleSheets(syncBulk = false) {
    const webhookUrl = state.settings.gasWebhookUrl;
    if (!webhookUrl) {
      alert('Google Apps Script Webhook URL is not configured. Please paste your Web App deployment URL in Settings.');
      switchTab('tabSettings');
      return;
    }

    setSyncLoading(true, 'SYNCING');

    // Build payload mapping single-line 3-box format to set arrays for backend compatibility
    const currentDayData = JSON.parse(JSON.stringify(ensureDay(activeDate)));
    if (currentDayData.workouts && currentDayData.workouts.exercises) {
      for (const exName in currentDayData.workouts.exercises) {
        const item = currentDayData.workouts.exercises[exName];
        if (typeof item === 'object' && !Array.isArray(item)) {
          const setsArr = [];
          const sCount = Number(item.sets || 3);
          for (let s = 1; s <= sCount; s++) {
            setsArr.push({
              set: s,
              weight: item.weight || '',
              reps: item.reps || '',
              completed: true
            });
          }
          currentDayData.workouts.exercises[exName] = setsArr;
        }
      }
    }

    const payload = syncBulk
      ? { action: 'syncBulk', days: state.days }
      : { action: 'syncDay', date: activeDate, dayData: currentDayData };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
      clearTimeout(timeoutId);

      const result = await response.json().catch(() => ({ status: 'success' }));

      if (syncBulk) {
        for (const d in state.days) {
          state.days[d].synced = true;
        }
      } else {
        ensureDay(activeDate).synced = true;
      }
      saveState(true);

      showToast(syncBulk ? 'All Telemetry Synced to Google Sheets' : "Today's Telemetry Synced to Cloud", 'cloud');

    } catch (err) {
      console.warn('[TAHITI] Cloud sync failed or CORS restricted:', err);
      ensureDay(activeDate).synced = true;
      saveState(true);
      showToast('Sync request dispatched to Google Sheets', 'cloud');
    } finally {
      clearTimeout(timeoutId);
      setSyncLoading(false);
      updateSyncStatusUI();
    }
  }

  // --- TAB NAVIGATION ENGINE ---

  function switchTab(targetId) {
    document.querySelectorAll('.tab-pane').forEach((pane) => {
      pane.classList.add('hidden');
    });

    const activePane = document.getElementById(targetId);
    if (activePane) {
      activePane.classList.remove('hidden');
    }

    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      const pill = btn.querySelector('.nav-active-pill');
      if (btn.getAttribute('data-target') === targetId) {
        btn.classList.add('text-cyan-400');
        btn.classList.remove('text-slate-400');
        if (pill) pill.classList.remove('hidden');
      } else {
        btn.classList.remove('text-cyan-400');
        btn.classList.add('text-slate-400');
        if (pill) pill.classList.add('hidden');
      }
    });

    // Update scoped Top HUD visibility
    const topHudSection = document.getElementById('topHudSection');
    const hudNutritionView = document.getElementById('hudNutritionView');
    const hudTrainingView = document.getElementById('hudTrainingView');
    const hudBiometricsView = document.getElementById('hudBiometricsView');

    if (targetId === 'tabSettings') {
      if (topHudSection) topHudSection.classList.add('hidden');
    } else {
      if (topHudSection) topHudSection.classList.remove('hidden');
      if (hudNutritionView) hudNutritionView.classList.toggle('hidden', targetId !== 'tabNutrition');
      if (hudTrainingView) hudTrainingView.classList.toggle('hidden', targetId !== 'tabGym');
      if (hudBiometricsView) hudBiometricsView.classList.toggle('hidden', targetId !== 'tabBiometrics');
    }

    // Re-render components of that tab
    if (targetId === 'tabBiometrics') renderTabBiometrics();
    if (targetId === 'tabNutrition') renderTabNutrition();
    if (targetId === 'tabGym') renderTabGym();
    if (targetId === 'tabSettings') renderTabSettings();

    renderTopHUD();

    if (window.lucide) lucide.createIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- TOAST NOTIFICATIONS ---

  let toastTimeout = null;
  function showToast(message, iconName = 'check-circle') {
    const toast = document.getElementById('toastNotification');
    const msgEl = document.getElementById('toastMessage');
    const iconEl = document.getElementById('toastIcon');
    if (!toast || !msgEl) return;

    if (toastTimeout) clearTimeout(toastTimeout);

    msgEl.textContent = message;
    if (iconEl && iconName) {
      iconEl.setAttribute('data-lucide', iconName);
      if (window.lucide) lucide.createIcons();
    }

    toast.classList.remove('opacity-0', '-translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');

    toastTimeout = setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-4');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }



  // --- EXERCISE ROUTINE MANAGER MODAL LOGIC ---

  function openExerciseManager() {
    const modal = document.getElementById('exerciseManagerModal');
    const select = document.getElementById('exerciseManagerSplitSelect');
    if (!modal || !select) return;

    renderExerciseManagerList(select.value);
    modal.classList.remove('hidden');
  }

  function renderExerciseManagerList(splitKey) {
    const list = document.getElementById('exerciseManagerList');
    if (!list) return;

    list.innerHTML = '';
    const exList = state.settings.exercises[splitKey] || [];

    exList.forEach((exName, idx) => {
      const item = document.createElement('div');
      item.className = 'bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800 flex items-center justify-between text-xs';
      item.innerHTML = `
        <span class="text-slate-200 font-mono">${escapeHtml(exName)}</span>
        <button type="button" class="del-ex-btn text-slate-500 hover:text-rose-400 p-1" data-idx="${idx}">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;

      item.querySelector('.del-ex-btn').addEventListener('click', () => {
        exList.splice(idx, 1);
        saveState();
        renderExerciseManagerList(splitKey);
        renderTabGym();
      });

      list.appendChild(item);
    });

    if (window.lucide) lucide.createIcons();
  }

  // --- EVENT LISTENERS INITIALIZATION ---

  function setupEventListeners() {

    // 1. Navigation Tabs
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        switchTab(target);
      });
    });

    // 2. Date Navigation
    const datePicker = document.getElementById('datePicker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        if (e.target.value) {
          activeDate = e.target.value;
          refreshAllUI();
        }
      });
    }

    document.getElementById('prevDateBtn')?.addEventListener('click', () => {
      const d = new Date(activeDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      activeDate = `${year}-${month}-${day}`;
      refreshAllUI();
    });

    document.getElementById('nextDateBtn')?.addEventListener('click', () => {
      const d = new Date(activeDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      activeDate = `${year}-${month}-${day}`;
      refreshAllUI();
    });

    document.getElementById('todayBtn')?.addEventListener('click', () => {
      activeDate = getTodayDateString();
      refreshAllUI();
    });

    // 3. Quick Cloud Sync
    document.getElementById('quickSyncBtn')?.addEventListener('click', () => {
      syncToGoogleSheets(false);
    });
    document.getElementById('syncNowBtn')?.addEventListener('click', () => {
      syncToGoogleSheets(false);
    });
    document.getElementById('pullCloudBtn')?.addEventListener('click', () => {
      pullFromGoogleSheets(false);
    });
    document.getElementById('syncAllBtn')?.addEventListener('click', () => {
      syncToGoogleSheets(true);
    });

    // 4. Tab 1: Biometrics Inputs Auto-Save
    const bioInputs = [
      { id: 'inputBioWeight', field: 'weight' },
      { id: 'inputBioSubcutFat', field: 'subcutaneousFat' },
      { id: 'inputBioWaistBraced', field: 'waistBraced' },
      { id: 'inputBioWaistRelaxed', field: 'waistRelaxed' },
      { id: 'inputBioSteps', field: 'steps' }
    ];

    bioInputs.forEach(({ id, field }) => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', (e) => {
          const day = ensureDay(activeDate);
          day.biometrics[field] = e.target.value === '' ? null : Number(e.target.value);
          saveState();
          if (field === 'steps') {
            renderTopHUD();
            renderTabBiometrics();
          }
          if (field === 'weight') updateWeightTrendDisplay(day.biometrics.weight);
        });
      }
    });

    // Step quick add buttons (+1k, +2k, +5k)
    document.querySelectorAll('.step-quick-add').forEach((btn) => {
      btn.addEventListener('click', () => {
        const toAdd = Number(btn.getAttribute('data-add') || 1000);
        const day = ensureDay(activeDate);
        const currentSteps = Number(day.biometrics.steps || 0);
        day.biometrics.steps = currentSteps + toAdd;
        document.getElementById('inputBioSteps').value = day.biometrics.steps;
        saveState();
        renderTopHUD();
        renderTabBiometrics();
        showToast(`+${toAdd.toLocaleString()} steps added`, 'footprints');
      });
    });

    // Habit Toggle (Stomach Vacuums)
    const vacCheck = document.getElementById('habitVacuums');
    if (vacCheck) {
      vacCheck.addEventListener('change', (e) => {
        const day = ensureDay(activeDate);
        day.habits.vacuums = e.target.checked;
        saveState();
        updateHabitsScoreUI(day.habits);
      });
    }

    // 5. Tab 2: Modals & Manual Meal
    document.getElementById('openAiModalBtn')?.addEventListener('click', () => {
      document.getElementById('aiVisionModal').classList.remove('hidden');
    });
    document.getElementById('closeAiModalBtn')?.addEventListener('click', () => {
      document.getElementById('aiVisionModal').classList.add('hidden');
    });

    // Inline AI Estimate Button
    document.getElementById('quickAiEstimateBtn')?.addEventListener('click', () => {
      estimateCustomMealWithAi();
    });

    // Inline Quick Macro Form Submit (Offline / Zero-API)
    document.getElementById('quickMacroForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('quickMacroName').value.trim();
      const kcal = Number(document.getElementById('quickMacroKcal').value || 0);
      const protein = Number(document.getElementById('quickMacroProtein').value || 0);
      const carbs = Number(document.getElementById('quickMacroCarbs').value || 0);
      const fat = Number(document.getElementById('quickMacroFat').value || 0);

      if (!name) return;

      const day = ensureDay(activeDate);
      day.meals.push({
        id: 'manual-' + Date.now(),
        time: formatTimeNow(),
        name: name,
        kcal: kcal,
        protein: protein,
        carbs: carbs,
        fat: fat,
        source: 'manual'
      });

      saveState();
      renderTopHUD();
      renderLoggedMealsFeed();
      renderPresetsList();
      renderPresetsList();

      // Reset form
      document.getElementById('quickMacroForm').reset();
      showToast(`Logged: ${name} (+${protein}g P)`, 'check-circle');
    });

    // AI Vision: Dropzone & Image Selection
    const imageDropzone = document.getElementById('imageDropzone');
    const aiImageInput = document.getElementById('aiImageInput');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const removeImageBtn = document.getElementById('removeImageBtn');

    imageDropzone?.addEventListener('click', (e) => {
      if (e.target !== removeImageBtn && !removeImageBtn.contains(e.target)) {
        aiImageInput.click();
      }
    });

    aiImageInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        aiImageMime = file.type;
        const reader = new FileReader();
        reader.onload = (re) => {
          const fullDataUrl = re.target.result;
          imagePreview.src = fullDataUrl;
          aiImageBase64 = fullDataUrl.split(',')[1];
          dropzoneContent.classList.add('hidden');
          imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });

    removeImageBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      aiImageBase64 = null;
      aiImageMime = null;
      aiImageInput.value = '';
      imagePreview.src = '';
      imagePreviewContainer.classList.add('hidden');
      dropzoneContent.classList.remove('hidden');
    });

    // Execute AI Analysis Button
    document.getElementById('runAiAnalysisBtn')?.addEventListener('click', () => {
      executeAiAnalysis();
    });

    // Commit AI Meal to Log
    document.getElementById('commitAiMealBtn')?.addEventListener('click', () => {
      const name = document.getElementById('aiResultName').value.trim();
      const kcal = Number(document.getElementById('aiResultKcal').value || 0);
      const protein = Number(document.getElementById('aiResultProtein').value || 0);
      const carbs = Number(document.getElementById('aiResultCarbs').value || 0);
      const fat = Number(document.getElementById('aiResultFat').value || 0);

      const day = ensureDay(activeDate);
      day.meals.push({
        id: 'ai-' + Date.now(),
        time: formatTimeNow(),
        name: name,
        kcal: kcal,
        protein: protein,
        carbs: carbs,
        fat: fat,
        source: 'ai'
      });

      saveState();
      renderTopHUD();
      renderLoggedMealsFeed();
      renderPresetsList();

      // Close modal & reset
      document.getElementById('aiVisionModal').classList.add('hidden');
      document.getElementById('aiResultCard').classList.add('hidden');
      document.getElementById('aiTextDescription').value = '';
      removeImageBtn.click();

      showToast(`Logged AI Meal: ${name}`, 'sparkles');
    });

    // 6. Tab 3: Split Selector Buttons
    document.querySelectorAll('.split-select-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const split = btn.getAttribute('data-split');
        const day = ensureDay(activeDate);
        day.workouts.activeSplit = split;
        saveState();
        renderTabGym();
      });
    });

    // 7. Tab 4: Copy 7-Day Telemetry Prompt
    document.getElementById('copyTelemetryBtn')?.addEventListener('click', async () => {
      const telemetryMarkdown = compile7DayTelemetry();
      try {
        await navigator.clipboard.writeText(telemetryMarkdown);
        const notice = document.getElementById('telemetryCopiedNotice');
        if (notice) {
          notice.classList.remove('hidden');
          setTimeout(() => notice.classList.add('hidden'), 4000);
        }
        showToast('7-Day Telemetry Copied to Clipboard!', 'check-check');
      } catch (err) {
        console.warn('Clipboard write failed, showing prompt fallback:', err);
        prompt('Copy your 7-Day Telemetry below:', telemetryMarkdown);
      }
    });

    // Settings: Save Webhook & Gemini API
    document.getElementById('settingGasUrl')?.addEventListener('change', (e) => {
      state.settings.gasWebhookUrl = e.target.value.trim();
      saveState();
      showToast('Webhook URL saved', 'cloud');
    });

    document.getElementById('settingGeminiApiKey')?.addEventListener('change', (e) => {
      state.settings.geminiApiKey = e.target.value.trim();
      saveState();
      showToast('Gemini API Key secured locally', 'key');
    });

    document.getElementById('settingGeminiModel')?.addEventListener('change', (e) => {
      state.settings.geminiModel = e.target.value.trim() || 'gemini-2.5-flash';
      saveState();
      showToast(`Gemini model set to ${state.settings.geminiModel}`, 'bot');
    });

    document.getElementById('toggleApiKeyVisibility')?.addEventListener('click', () => {
      const keyInput = document.getElementById('settingGeminiApiKey');
      if (keyInput) {
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
      }
    });

    // Settings: Save Recomp Targets
    document.getElementById('saveTargetsBtn')?.addEventListener('click', () => {
      state.settings.targets = {
        calories: Number(document.getElementById('settingTargetCalories').value || 1650),
        protein: Number(document.getElementById('settingTargetProtein').value || 140),
        carbs: Number(document.getElementById('settingTargetCarbs').value || 130),
        fat: Number(document.getElementById('settingTargetFat').value || 50),
        steps: Number(document.getElementById('settingTargetSteps').value || 8000)
      };
      saveState();
      renderTopHUD();
      showToast('Daily Recomp Targets Updated', 'target');
    });

    // Exercise Routine Manager Modal
    document.getElementById('openExerciseManagerBtn')?.addEventListener('click', openExerciseManager);
    document.getElementById('closeExerciseManagerBtn')?.addEventListener('click', () => {
      document.getElementById('exerciseManagerModal').classList.add('hidden');
    });
    document.getElementById('doneExerciseManagerBtn')?.addEventListener('click', () => {
      document.getElementById('exerciseManagerModal').classList.add('hidden');
    });

    document.getElementById('exerciseManagerSplitSelect')?.addEventListener('change', (e) => {
      renderExerciseManagerList(e.target.value);
    });

    document.getElementById('addNewExerciseBtn')?.addEventListener('click', () => {
      const splitKey = document.getElementById('exerciseManagerSplitSelect').value;
      const exInput = document.getElementById('newExerciseName');
      const exName = exInput.value.trim();
      if (!exName) return;

      if (!state.settings.exercises[splitKey]) {
        state.settings.exercises[splitKey] = [];
      }
      state.settings.exercises[splitKey].push(exName);
      exInput.value = '';
      saveState();
      renderExerciseManagerList(splitKey);
      renderTabGym();
      showToast(`Added Exercise: ${exName}`, 'plus');
    });

    document.getElementById('restoreDefaultExercisesBtn')?.addEventListener('click', () => {
      if (confirm('Restore default exercises for all splits?')) {
        state.settings.exercises = JSON.parse(JSON.stringify(DEFAULT_EXERCISES));
        saveState();
        renderExerciseManagerList(document.getElementById('exerciseManagerSplitSelect').value);
        renderTabGym();
        showToast('Default Exercises Restored', 'refresh-cw');
      }
    });

    // 1-Tap Mobile Pairing Link
    document.getElementById('copyMobilePairingBtn')?.addEventListener('click', async () => {
      try {
        const payload = {
          geminiApiKey: state.settings.geminiApiKey || '',
          geminiModel: state.settings.geminiModel || 'gemini-2.5-flash',
          gasWebhookUrl: state.settings.gasWebhookUrl || '',
          targets: state.settings.targets
        };
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const pairingUrl = window.location.origin + window.location.pathname + '#setup=' + b64;
        await navigator.clipboard.writeText(pairingUrl);
        showToast('Mobile Setup Link Copied! Send it to your phone', 'share-2');
      } catch (err) {
        console.warn('Clipboard write failed:', err);
        const payload = {
          geminiApiKey: state.settings.geminiApiKey || '',
          geminiModel: state.settings.geminiModel || 'gemini-2.5-flash',
          gasWebhookUrl: state.settings.gasWebhookUrl || '',
          targets: state.settings.targets
        };
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        prompt('Copy your Mobile Setup Link below:', window.location.origin + window.location.pathname + '#setup=' + b64);
      }
    });

    // Telemetry Storage Vault: Export & Import
    document.getElementById('exportBackupBtn')?.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `tahiti-backup-${getTodayDateString()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Telemetry Backup Exported', 'download');
    });

    document.getElementById('importBackupInput')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported && imported.settings && imported.days) {
            state = imported;
            saveState();
            refreshAllUI();
            showToast('Telemetry Backup Restored Successfully', 'check-circle');
          } else {
            alert('Invalid TAHITI backup file format.');
          }
        } catch (err) {
          alert('Failed to parse backup JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('resetDefaultsBtn')?.addEventListener('click', () => {
      const confirmed = confirm('WARNING: This will permanently wipe all local biometrics, meals, and gym logs, resetting to factory defaults. Continue?');
      if (confirmed) {
        localStorage.removeItem(STORAGE_KEY);
        state = {
          version: 2,
          settings: {
            geminiApiKey: '',
            geminiModel: 'gemini-2.5-flash',
            gasWebhookUrl: '',
            targets: { ...DEFAULT_TARGETS },
            presets: JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
            exercises: JSON.parse(JSON.stringify(DEFAULT_EXERCISES))
          },
          days: {}
        };
        activeDate = getTodayDateString();
        saveState();
        refreshAllUI();
        showToast('System Reset to Factory Defaults', 'refresh-cw');
      }
    });

    // Deep Linking support via query param (e.g. ?tab=nutrition)
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'nutrition') switchTab('tabNutrition');
    else if (tabParam === 'gym') switchTab('tabGym');
    else if (tabParam === 'settings') switchTab('tabSettings');
    else switchTab('tabBiometrics');
  }

  function checkUrlPairing() {
    if (window.location.hash && window.location.hash.startsWith('#setup=')) {
      try {
        const rawB64 = window.location.hash.substring(7);
        const jsonStr = decodeURIComponent(escape(atob(rawB64)));
        const imported = JSON.parse(jsonStr);
        if (imported && typeof imported === 'object') {
          state.settings = {
            ...state.settings,
            ...imported
          };
          saveState();
          showToast('JARVIS Setup Synchronized!', 'smartphone');
          window.history.replaceState(null, null, window.location.pathname + window.location.search);
        }
      } catch (err) {
        console.warn('[TAHITI] Setup hash pairing failed:', err);
      }
    }
  }

  // --- BOOTSTRAP APPLICATION ---
  window.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkUrlPairing();
    setupEventListeners();
    refreshAllUI();

    // Auto-sync from cloud if webhook is configured
    if (state.settings.gasWebhookUrl) {
      pullFromGoogleSheets(true);
    }

    console.log('[TAHITI] Project TAHITI v2.3 Initialized.');
  });

})();

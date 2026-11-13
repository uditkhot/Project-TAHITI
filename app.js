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
      name: '1 Scoop Whey Isolate',
      kcal: 120,
      protein: 27,
      carbs: 1,
      fat: 0.5
    },
    {
      id: 'p-3',
      time: '01:30 PM',
      name: "Cook's 2 Phulkas (no oil) + Bhaji + 150g Air-Fried Chicken + Chaas",
      kcal: 550,
      protein: 42,
      carbs: 58,
      fat: 14
    },
    {
      id: 'p-4',
      time: '01:30 PM',
      name: "Cook's 2 Phulkas + Bhaji + 100g Low-Fat Paneer + Chaas (Veg Alt)",
      kcal: 540,
      protein: 28,
      carbs: 60,
      fat: 20
    },
    {
      id: 'p-5',
      time: '08:30 PM',
      name: "Rutuja's Chicken Wrap - 180g Chicken + Whole Wheat Roti + Hung Curd Dressing",
      kcal: 560,
      protein: 46,
      carbs: 45,
      fat: 18
    },
    {
      id: 'p-6',
      time: '08:30 PM',
      name: "Rutuja's 200g Tandoori/Grilled Chicken + Veggies",
      kcal: 480,
      protein: 48,
      carbs: 18,
      fat: 20
    },
    {
      id: 'p-7',
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
      'Incline DB Press',
      'Lat Pulldown / DB Row',
      'Seated DB Shoulder Press',
      'DB Lateral Raises',
      'Cable Tricep Pushdown',
      'DB Bicep Curls',
      'Weighted Cable/Bench Crunches'
    ],
    lower: [
      'DB Goblet Squats',
      'DB Romanian Deadlifts',
      'DB Walking Lunges',
      'Standing Calf Raises',
      'Hanging Knee / Lying Leg Raises (Pelvic Curl)',
      'RKC Plank'
    ],
    full: [
      'Incline DB Press',
      'Lat Pulldown / DB Row',
      'DB Goblet Squats',
      'DB Romanian Deadlifts',
      'DB Lateral Raises',
      'RKC Plank'
    ]
  };

  // --- GLOBAL STATE ---
  let state = {
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
          exercises: {}
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
        state.days[dateStr].workouts = { activeSplit: 'upper', exercises: {} };
      }
      if (!state.days[dateStr].workouts.exercises) {
        state.days[dateStr].workouts.exercises = {};
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
          // Merge settings
          state.settings = {
            ...state.settings,
            ...(parsed.settings || {}),
            targets: { ...DEFAULT_TARGETS, ...(parsed.settings?.targets || {}) },
            presets: parsed.settings?.presets && parsed.settings.presets.length > 0 ? parsed.settings.presets : JSON.parse(JSON.stringify(DEFAULT_PRESETS)),
            exercises: parsed.settings?.exercises || JSON.parse(JSON.stringify(DEFAULT_EXERCISES))
          };
          state.days = parsed.days || {};
          console.log('[TAHITI] State loaded successfully from localStorage');
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

  function saveState() {
    try {
      if (state.days[activeDate]) {
        state.days[activeDate].lastModified = new Date().toISOString();
        state.days[activeDate].synced = false;
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

  // 2. Top HUD: Calories, Macros, and Steps
  function renderTopHUD() {
    const currentDay = ensureDay(activeDate);
    const targets = state.settings.targets || DEFAULT_TARGETS;

    // Calculate totals for active date
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

    const steps = Number(currentDay.biometrics.steps || 0);

    // Calories
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
    document.getElementById('hudProteinCurrent').textContent = pCurrent;
    document.getElementById('hudProteinTarget').textContent = `${targets.protein}g`;
    document.getElementById('hudProteinPct').textContent = `${pPct}%`;
    document.getElementById('hudProteinBar').style.width = `${pPct}%`;

    // Carbs
    const cCurrent = Math.round(totalCarbs * 10) / 10;
    const cPct = Math.min(100, Math.round((cCurrent / (targets.carbs || 1)) * 100));
    document.getElementById('hudCarbsCurrent').textContent = cCurrent;
    document.getElementById('hudCarbsTarget').textContent = `${targets.carbs}g`;
    document.getElementById('hudCarbsPct').textContent = `${cPct}%`;
    document.getElementById('hudCarbsBar').style.width = `${cPct}%`;

    // Fat
    const fCurrent = Math.round(totalFat * 10) / 10;
    const fPct = Math.min(100, Math.round((fCurrent / (targets.fat || 1)) * 100));
    document.getElementById('hudFatCurrent').textContent = fCurrent;
    document.getElementById('hudFatTarget').textContent = `${targets.fat}g`;
    document.getElementById('hudFatPct').textContent = `${fPct}%`;
    document.getElementById('hudFatBar').style.width = `${fPct}%`;

    // Steps
    const stepsPct = Math.min(100, Math.round((steps / (targets.steps || 1)) * 100));
    document.getElementById('hudStepsCurrent').textContent = steps.toLocaleString();
    document.getElementById('hudStepsTarget').textContent = (targets.steps || 8000).toLocaleString();
    document.getElementById('hudStepsBar').style.width = `${stepsPct}%`;
  }

  // 3. Tab 1: Biometrics & Core Habits
  function renderTabBiometrics() {
    const day = ensureDay(activeDate);
    const bio = day.biometrics || {};
    const habits = day.habits || {};

    // Numeric inputs
    document.getElementById('inputBioWeight').value = bio.weight !== null ? bio.weight : '';
    document.getElementById('inputBioSubcutFat').value = bio.subcutaneousFat !== null ? bio.subcutaneousFat : '';
    document.getElementById('inputBioWaistBraced').value = bio.waistBraced !== null ? bio.waistBraced : '';
    document.getElementById('inputBioWaistRelaxed').value = bio.waistRelaxed !== null ? bio.waistRelaxed : '';
    document.getElementById('inputBioSteps').value = bio.steps || '';

    // Calculate weight trend compared to previous entry
    updateWeightTrendDisplay(bio.weight);

    // Habit toggles
    document.getElementById('habitVacuums').checked = !!habits.vacuums;
    document.getElementById('habitCookOil').checked = !!habits.cookOil;
    document.getElementById('habitCokeZero').checked = !!habits.cokeZero;

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
    let completed = 0;
    if (habits.vacuums) completed++;
    if (habits.cookOil) completed++;
    if (habits.cokeZero) completed++;

    const scoreBadge = document.getElementById('habitsScoreBadge');
    if (scoreBadge) {
      scoreBadge.textContent = `${completed}/3 Locked`;
      if (completed === 3) {
        scoreBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-400 shadow-glow-emerald';
      } else {
        scoreBadge.className = 'text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700';
      }
    }
  }

  // 4. Tab 2: Clockwork Nutrition (Presets & Feed)
  function renderTabNutrition() {
    renderPresetsList();
    renderLoggedMealsFeed();
  }

  function renderPresetsList() {
    const container = document.getElementById('presetsContainer');
    if (!container) return;

    const presets = state.settings.presets || DEFAULT_PRESETS;
    container.innerHTML = '';

    presets.forEach((preset) => {
      const card = document.createElement('div');
      card.className = 'p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition flex items-center justify-between group cursor-pointer active:scale-[0.99]';
      
      card.innerHTML = `
        <div class="flex-1 mr-2">
          <div class="flex items-center space-x-1.5 mb-1">
            <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">${escapeHtml(preset.time || 'MEAL')}</span>
            <span class="text-xs font-semibold text-slate-200 line-clamp-1">${escapeHtml(preset.name)}</span>
          </div>
          <div class="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
            <span class="text-cyan-400 font-bold">${preset.kcal} kcal</span>
            <span>&bull;</span>
            <span class="text-sky-300 font-semibold">${preset.protein}g P</span>
            <span>&bull;</span>
            <span class="text-emerald-300">${preset.carbs}g C</span>
            <span>&bull;</span>
            <span class="text-amber-300">${preset.fat}g F</span>
          </div>
        </div>
        <button type="button" class="preset-log-btn px-2.5 py-1.5 rounded-md bg-cyan-950/90 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 font-mono text-xs font-bold transition flex items-center space-x-1 shadow-glow-cyan-sm" data-id="${preset.id}">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>LOG</span>
        </button>
      `;

      // Entire card or button logs the preset
      card.addEventListener('click', (e) => {
        logPresetMeal(preset);
      });

      container.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  function logPresetMeal(preset) {
    const day = ensureDay(activeDate);
    const newMeal = {
      id: 'm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      time: preset.time || formatTimeNow(),
      name: preset.name,
      kcal: Number(preset.kcal || 0),
      protein: Number(preset.protein || 0),
      carbs: Number(preset.carbs || 0),
      fat: Number(preset.fat || 0),
      source: 'preset'
    };

    day.meals.push(newMeal);
    saveState();
    renderTopHUD();
    renderLoggedMealsFeed();
    showToast(`Logged: ${preset.name.split(' - ')[0]} (+${preset.protein}g P)`, 'check-circle');
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
      showToast(`Removed: ${removed.name}`, 'trash');
    }
  }

  // 5. Tab 3: 10:15 AM Gym Logger (Progressive Overload)
  function renderTabGym() {
    const day = ensureDay(activeDate);
    const activeSplit = day.workouts.activeSplit || 'upper';

    // Highlight Split Selector Buttons
    document.querySelectorAll('.split-select-btn').forEach((btn) => {
      const split = btn.getAttribute('data-split');
      if (split === activeSplit) {
        btn.className = 'split-select-btn py-1.5 px-2 rounded font-semibold text-center transition bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan-sm';
      } else {
        btn.className = 'split-select-btn py-1.5 px-2 rounded font-semibold text-center transition text-slate-400 hover:text-slate-200 hover:bg-slate-900';
      }
    });

    // Render Exercises for Active Split
    const exercisesContainer = document.getElementById('workoutExercisesContainer');
    if (!exercisesContainer) return;
    exercisesContainer.innerHTML = '';

    const splitExercises = state.settings.exercises[activeSplit] || DEFAULT_EXERCISES[activeSplit] || [];
    let totalTonnage = 0;

    splitExercises.forEach((exName) => {
      // Query historical top set across all sessions
      const topSetInfo = getHistoricalTopSet(exName, activeDate);

      // Current session's sets for this exercise
      if (!day.workouts.exercises[exName]) {
        // Initialize with 3 empty sets if completely uninitialized
        day.workouts.exercises[exName] = [
          { set: 1, weight: '', reps: '', completed: false },
          { set: 2, weight: '', reps: '', completed: false },
          { set: 3, weight: '', reps: '', completed: false }
        ];
      }

      const sets = day.workouts.exercises[exName];
      let exVolume = 0;
      sets.forEach((s) => {
        if (s.weight && s.reps) {
          const v = Number(s.weight) * Number(s.reps);
          exVolume += v;
          totalTonnage += v;
        }
      });

      const card = document.createElement('div');
      card.className = 'bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5';

      // Header: Exercise Title, Top Set Badge, and Volume
      const topSetBadge = topSetInfo
        ? `<span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1">
             <i data-lucide="zap" class="w-3 h-3 text-cyan-400"></i>
             <span>Last Top: <strong>${topSetInfo.weight}kg &times; ${topSetInfo.reps}</strong></span>
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
          <button type="button" class="add-set-btn text-[10px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1" data-ex="${escapeHtml(exName)}">
            <i data-lucide="plus" class="w-3 h-3"></i>
            <span>Add Set</span>
          </button>
        </div>

        <!-- Sets Table -->
        <div class="space-y-1.5 pt-1">
          <div class="grid grid-cols-12 gap-1.5 text-[9px] font-mono text-slate-500 uppercase px-1">
            <div class="col-span-2">Set</div>
            <div class="col-span-4">Weight (kg)</div>
            <div class="col-span-4">Reps</div>
            <div class="col-span-2 text-center">Done</div>
          </div>
          <div class="sets-rows-container space-y-1.5" data-ex="${escapeHtml(exName)}">
            <!-- Set rows inserted here -->
          </div>
        </div>
      `;

      // Render Set Rows
      const rowsContainer = card.querySelector('.sets-rows-container');
      sets.forEach((setObj, sIdx) => {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 gap-1.5 items-center bg-slate-950/60 p-1.5 rounded-lg border border-slate-800/80';
        
        row.innerHTML = `
          <div class="col-span-2 text-xs font-mono font-bold text-slate-400 text-center">#${sIdx + 1}</div>
          <div class="col-span-4">
            <input type="number" step="0.5" class="set-weight-input w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-400 rounded px-1.5 py-1 text-xs font-mono text-cyan-300 text-center focus:outline-none"
              placeholder="kg" value="${setObj.weight !== '' ? setObj.weight : ''}">
          </div>
          <div class="col-span-4">
            <input type="number" step="1" class="set-reps-input w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-400 rounded px-1.5 py-1 text-xs font-mono text-cyan-300 text-center focus:outline-none"
              placeholder="reps" value="${setObj.reps !== '' ? setObj.reps : ''}">
          </div>
          <div class="col-span-2 flex items-center justify-center space-x-1">
            <button type="button" class="toggle-set-done p-1 rounded ${setObj.completed ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 shadow-glow-emerald' : 'bg-slate-900 text-slate-600 border border-slate-800'}" title="Toggle set complete">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="remove-set-btn p-1 rounded text-slate-600 hover:text-rose-400" title="Remove set">
              <i data-lucide="x" class="w-3 h-3"></i>
            </button>
          </div>
        `;

        // Event listeners for inputs
        const weightInput = row.querySelector('.set-weight-input');
        const repsInput = row.querySelector('.set-reps-input');
        const doneBtn = row.querySelector('.toggle-set-done');
        const removeBtn = row.querySelector('.remove-set-btn');

        weightInput.addEventListener('input', (e) => {
          setObj.weight = e.target.value;
          saveState();
          updateTonnageBadge();
        });

        repsInput.addEventListener('input', (e) => {
          setObj.reps = e.target.value;
          saveState();
          updateTonnageBadge();
        });

        doneBtn.addEventListener('click', () => {
          setObj.completed = !setObj.completed;
          saveState();
          renderTabGym();
        });

        removeBtn.addEventListener('click', () => {
          sets.splice(sIdx, 1);
          saveState();
          renderTabGym();
        });

        rowsContainer.appendChild(row);
      });

      // Add Set Button
      card.querySelector('.add-set-btn').addEventListener('click', () => {
        // Pre-fill with last set's weight if available
        const lastSet = sets[sets.length - 1];
        const newWeight = lastSet ? lastSet.weight : '';
        const newReps = lastSet ? lastSet.reps : '';
        sets.push({ set: sets.length + 1, weight: newWeight, reps: newReps, completed: false });
        saveState();
        renderTabGym();
      });

      exercisesContainer.appendChild(card);
    });

    // Update Tonnage Badge
    const tonnageBadge = document.getElementById('gymTonnageBadge');
    if (tonnageBadge) {
      tonnageBadge.textContent = `${totalTonnage.toLocaleString()} kg Tonnage`;
    }

    if (window.lucide) lucide.createIcons();
  }

  function updateTonnageBadge() {
    const day = ensureDay(activeDate);
    let totalTonnage = 0;
    const exercises = day.workouts.exercises || {};
    for (const ex in exercises) {
      if (Array.isArray(exercises[ex])) {
        exercises[ex].forEach((s) => {
          if (s.weight && s.reps) {
            totalTonnage += Number(s.weight) * Number(s.reps);
          }
        });
      }
    }
    const tonnageBadge = document.getElementById('gymTonnageBadge');
    if (tonnageBadge) {
      tonnageBadge.textContent = `${totalTonnage.toLocaleString()} kg Tonnage`;
    }
  }

  // Query historical top set across all sessions
  function getHistoricalTopSet(exerciseName, excludeDate) {
    let topWeight = -1;
    let topReps = -1;
    let topDate = null;

    const dates = Object.keys(state.days).sort();
    for (const d of dates) {
      if (d === excludeDate) continue;
      const dayData = state.days[d];
      if (dayData?.workouts?.exercises && dayData.workouts.exercises[exerciseName]) {
        const sets = dayData.workouts.exercises[exerciseName];
        if (Array.isArray(sets)) {
          sets.forEach((s) => {
            const w = Number(s.weight || 0);
            const r = Number(s.reps || 0);
            if (w > topWeight || (w === topWeight && r > topReps)) {
              topWeight = w;
              topReps = r;
              topDate = d;
            }
          });
        }
      }
    }

    if (topWeight > 0) {
      return { weight: topWeight, reps: topReps, date: topDate };
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
      tableRows.push(`| ${dStr} | ${bio.weight || '-'} | ${bio.subcutaneousFat || '-'} | ${bio.waistBraced || '-'} | ${bio.waistRelaxed || '-'} | ${bio.steps || 0} | ${Math.round(dayKcal)} | ${Math.round(dayP)} | ${Math.round(dayC)} | ${Math.round(dayF)} | ${habits.vacuums ? 'YES' : 'NO'} | ${habits.cookOil ? 'YES' : 'NO'} | ${habits.cokeZero ? 'YES' : 'NO'} |`);
    });

    const avgWeight = weightCount > 0 ? (totalWeight / weightCount).toFixed(1) : 'N/A';
    const avgSteps = stepsCount > 0 ? Math.round(totalSteps / 7) : 0;
    const avgKcal = daysWithMeals > 0 ? Math.round(totalKcal / 7) : 0;
    const avgProtein = daysWithMeals > 0 ? Math.round(totalProtein / 7) : 0;
    const avgCarbs = daysWithMeals > 0 ? Math.round(totalCarbs / 7) : 0;
    const avgFat = daysWithMeals > 0 ? Math.round(totalFat / 7) : 0;

    const targets = state.settings.targets || DEFAULT_TARGETS;

    const markdown = `# PROJECT TAHITI v2.0 // 7-DAY TELEMETRY UPLINK
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
- **Cook Oil Audit (<=1 tsp):** ${cookOilDone}/7 (${Math.round((cookOilDone / 7) * 100)}%)
- **Coke Zero Limit (Max 1 Can):** ${cokeZeroDone}/7 (${Math.round((cokeZeroDone / 7) * 100)}%)
- **Average Morning Fasted Weight:** ${avgWeight} kg

## 3. Daily Biometrics & Nutrition Matrix
| Date | Weight (kg) | Subcut (kg) | Waist Braced (in) | Waist Relaxed (in) | Steps | Kcal | P (g) | C (g) | F (g) | Vacuums | Oil Audit | Coke Zero |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
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

  // --- GOOGLE APPS SCRIPT WEBHOOK SYNC ---

  async function syncToGoogleSheets(syncBulk = false) {
    const webhookUrl = state.settings.gasWebhookUrl;
    if (!webhookUrl) {
      alert('Google Apps Script Webhook URL is not configured. Please paste your Web App deployment URL in Settings.');
      switchTab('tabSettings');
      return;
    }

    const syncStatusBadge = document.getElementById('syncStatusBadge');
    const syncIcon = document.getElementById('syncIcon');
    if (syncStatusBadge) syncStatusBadge.textContent = 'SYNCING';
    if (syncIcon) syncIcon.classList.add('animate-spin');

    const payload = syncBulk
      ? { action: 'syncBulk', days: state.days }
      : { action: 'syncDay', date: activeDate, dayData: ensureDay(activeDate) };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Apps Script handles text/plain CORS smoothly
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({ status: 'success' }));

      if (syncBulk) {
        for (const d in state.days) {
          state.days[d].synced = true;
        }
      } else {
        ensureDay(activeDate).synced = true;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSyncStatusUI();

      showToast(syncBulk ? 'All Telemetry Synced to Google Sheets' : "Today's Telemetry Synced to Cloud", 'cloud');

    } catch (err) {
      console.warn('[TAHITI] Cloud sync failed or CORS restricted:', err);
      // Note: Google Apps Script redirects with 302 can sometimes trigger opaque responses in browser fetch, but execution still succeeds.
      ensureDay(activeDate).synced = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      updateSyncStatusUI();
      showToast('Sync request dispatched to Google Sheets', 'cloud');
    } finally {
      if (syncIcon) syncIcon.classList.remove('animate-spin');
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

    // Re-render components of that tab
    if (targetId === 'tabBiometrics') renderTabBiometrics();
    if (targetId === 'tabNutrition') renderTabNutrition();
    if (targetId === 'tabGym') renderTabGym();
    if (targetId === 'tabSettings') renderTabSettings();

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

  // --- PRESET MANAGER MODAL LOGIC ---

  function openPresetManager() {
    const modal = document.getElementById('presetManagerModal');
    const list = document.getElementById('presetManagerList');
    if (!modal || !list) return;

    list.innerHTML = '';
    const presets = state.settings.presets || [];

    presets.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'bg-slate-950 p-2.5 rounded border border-slate-800 flex items-center justify-between';
      item.innerHTML = `
        <div class="flex-1 mr-2">
          <div class="font-bold text-slate-200 text-xs">${escapeHtml(p.name)}</div>
          <div class="text-[10px] text-slate-400 font-mono">${p.kcal} kcal | ${p.protein}g P | ${p.carbs}g C | ${p.fat}g F</div>
        </div>
        <button type="button" class="del-preset-btn text-slate-500 hover:text-rose-400 p-1" data-idx="${idx}">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;

      item.querySelector('.del-preset-btn').addEventListener('click', () => {
        presets.splice(idx, 1);
        saveState();
        openPresetManager();
        renderPresetsList();
      });

      list.appendChild(item);
    });

    if (window.lucide) lucide.createIcons();
    modal.classList.remove('hidden');
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
          if (field === 'steps') renderTopHUD();
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
        showToast(`+${toAdd.toLocaleString()} steps added`, 'footprints');
      });
    });

    // Habit Toggles
    const habitMap = [
      { id: 'habitVacuums', key: 'vacuums' },
      { id: 'habitCookOil', key: 'cookOil' },
      { id: 'habitCokeZero', key: 'cokeZero' }
    ];

    habitMap.forEach(({ id, key }) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          const day = ensureDay(activeDate);
          day.habits[key] = e.target.checked;
          saveState();
          updateHabitsScoreUI(day.habits);
        });
      }
    });

    // 5. Tab 2: Modals & Manual Meal
    document.getElementById('openAiModalBtn')?.addEventListener('click', () => {
      document.getElementById('aiVisionModal').classList.remove('hidden');
    });
    document.getElementById('closeAiModalBtn')?.addEventListener('click', () => {
      document.getElementById('aiVisionModal').classList.add('hidden');
    });

    document.getElementById('openManualModalBtn')?.addEventListener('click', () => {
      document.getElementById('manualMealModal').classList.remove('hidden');
    });
    document.getElementById('closeManualModalBtn')?.addEventListener('click', () => {
      document.getElementById('manualMealModal').classList.add('hidden');
    });

    // Manual Meal Form Submit
    document.getElementById('manualMealForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('manualMealName').value.trim();
      const kcal = Number(document.getElementById('manualMealKcal').value || 0);
      const protein = Number(document.getElementById('manualMealProtein').value || 0);
      const carbs = Number(document.getElementById('manualMealCarbs').value || 0);
      const fat = Number(document.getElementById('manualMealFat').value || 0);

      const day = ensureDay(activeDate);
      day.meals.push({
        id: 'm-' + Date.now(),
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
      document.getElementById('manualMealModal').classList.add('hidden');
      document.getElementById('manualMealForm').reset();
      showToast(`Logged: ${name}`, 'check-circle');
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

    // Presets Manager Modal
    document.getElementById('openPresetManagerBtn')?.addEventListener('click', openPresetManager);
    document.getElementById('closePresetManagerBtn')?.addEventListener('click', () => {
      document.getElementById('presetManagerModal').classList.add('hidden');
    });
    document.getElementById('donePresetManagerBtn')?.addEventListener('click', () => {
      document.getElementById('presetManagerModal').classList.add('hidden');
    });

    document.getElementById('addNewPresetBtn')?.addEventListener('click', () => {
      const name = document.getElementById('newPresetName').value.trim();
      const kcal = Number(document.getElementById('newPresetKcal').value || 0);
      const p = Number(document.getElementById('newPresetProtein').value || 0);
      const c = Number(document.getElementById('newPresetCarbs').value || 0);
      const f = Number(document.getElementById('newPresetFat').value || 0);

      if (!name) {
        alert('Please enter a preset name');
        return;
      }

      state.settings.presets.push({
        id: 'p-' + Date.now(),
        time: formatTimeNow(),
        name: name,
        kcal: kcal,
        protein: p,
        carbs: c,
        fat: f
      });

      document.getElementById('newPresetName').value = '';
      document.getElementById('newPresetKcal').value = '';
      document.getElementById('newPresetProtein').value = '';
      document.getElementById('newPresetCarbs').value = '';
      document.getElementById('newPresetFat').value = '';

      saveState();
      openPresetManager();
      renderPresetsList();
      showToast(`Added Preset: ${name}`, 'plus');
    });

    document.getElementById('restoreDefaultPresetsBtn')?.addEventListener('click', () => {
      if (confirm('Restore the 7 factory default nutrition presets?')) {
        state.settings.presets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
        saveState();
        openPresetManager();
        renderPresetsList();
        showToast('Default Presets Restored', 'refresh-cw');
      }
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
    else if (tabParam === 'biometrics') switchTab('tabBiometrics');
    else if (tabParam === 'settings') switchTab('tabSettings');
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
    console.log('[TAHITI] Project TAHITI v2.0 Initialized.');
  });

})();

/**
 * ============================================================================
 * PROJECT TAHITI (v2.3) — TELEMETRY & BODY RECOMPOSITION WEBHOOK
 * Google Apps Script Backend (Code.gs)
 * ============================================================================
 * 
 * Supports two-way cloud synchronization:
 * - POST: Commits telemetry (single-day or bulk) into Google Sheets
 * - GET: Pulls telemetry (fetchAll or fetchDay) down to PWA clients
 * ============================================================================
 */

// Configuration & Sheet Names
var SHEETS = {
  BIOMETRICS: "Biometrics",
  NUTRITION: "Nutrition",
  WORKOUTS: "Workouts",
  SUMMARY: "DailySummary"
};

/**
 * Handle HTTP GET Requests (Health Check & Two-Way Telemetry Pull)
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureSheetsAndHeaders(ss);
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
    
    if (action === "ping") {
      return createJsonResponse({
        status: "success",
        code: 200,
        message: "Project TAHITI v2.3 Webhook Operational",
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
        timestamp: new Date().toISOString()
      });
    }

    if (action === "fetchAll") {
      var allDays = readAllDays(ss);
      return createJsonResponse({
        status: "success",
        days: allDays,
        timestamp: new Date().toISOString()
      });
    }

    if (action === "fetchDay") {
      var date = e.parameter.date;
      if (!date) {
        return createJsonResponse({ status: "error", message: "Missing date parameter" });
      }
      var dayData = readDayData(ss, date);
      return createJsonResponse({ status: "success", date: date, data: dayData });
    }

    return createJsonResponse({
      status: "success",
      message: "TAHITI Webhook Ready. Use GET ?action=fetchAll to pull or POST to sync."
    });
  } catch (error) {
    return createJsonResponse({ status: "error", message: error.toString() });
  }
}

/**
 * Handle HTTP POST Requests (Telemetry Synchronization)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ status: "error", message: "No post data received" });
    }

    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ensure all required sheets and headers exist
    ensureSheetsAndHeaders(ss);

    var syncedCount = 0;
    var syncedDates = [];

    // Support single-day sync or bulk historical sync
    if (payload.action === "syncDay" && payload.dayData) {
      syncSingleDay(ss, payload.date, payload.dayData);
      syncedCount = 1;
      syncedDates.push(payload.date);
    } else if (payload.action === "syncBulk" && payload.days) {
      for (var d in payload.days) {
        if (payload.days.hasOwnProperty(d)) {
          syncSingleDay(ss, d, payload.days[d]);
          syncedCount++;
          syncedDates.push(d);
        }
      }
    } else if (payload.date && (payload.biometrics || payload.meals || payload.workouts)) {
      // Direct day object without wrapper
      syncSingleDay(ss, payload.date, payload);
      syncedCount = 1;
      syncedDates.push(payload.date);
    } else {
      return createJsonResponse({
        status: "error",
        message: "Invalid payload format. Expected {action: 'syncDay', date: '...', dayData: {...}}"
      });
    }

    return createJsonResponse({
      status: "success",
      message: "Telemetry securely committed to Google Sheets",
      syncedCount: syncedCount,
      dates: syncedDates,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return createJsonResponse({
      status: "error",
      message: "Sync failed: " + error.toString(),
      stack: error.stack
    });
  }
}

/**
 * Synchronize a single day's record across all sheets
 */
function syncSingleDay(ss, dateStr, day) {
  var now = new Date();
  var timestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

  // 1. Sync Biometrics & Habits
  if (day.biometrics || day.habits) {
    syncBiometrics(ss, dateStr, day.biometrics || {}, day.habits || {}, timestamp);
  }

  // 2. Sync Nutrition Log
  if (day.meals && Array.isArray(day.meals)) {
    syncNutrition(ss, dateStr, day.meals, timestamp);
  }

  // 3. Sync Workout Log
  if (day.workouts) {
    syncWorkouts(ss, dateStr, day.workouts, timestamp);
  }

  // 4. Sync Daily Rollup Summary
  syncSummary(ss, dateStr, day, timestamp);
}

/**
 * Upsert Biometrics (1 row per Date)
 */
function syncBiometrics(ss, dateStr, bio, habits, timestamp) {
  var sheet = ss.getSheetByName(SHEETS.BIOMETRICS);
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    var cellDate = normalizeDateString(data[i][0]);
    if (cellDate === dateStr) {
      rowIndex = i + 1; // 1-based row index
      break;
    }
  }

  var rowValues = [
    dateStr,
    bio.weight !== null && bio.weight !== undefined ? bio.weight : "",
    bio.subcutaneousFat !== null && bio.subcutaneousFat !== undefined ? bio.subcutaneousFat : "",
    bio.waistBraced !== null && bio.waistBraced !== undefined ? bio.waistBraced : "",
    bio.waistRelaxed !== null && bio.waistRelaxed !== undefined ? bio.waistRelaxed : "",
    bio.steps || 0,
    habits.vacuums ? "YES" : "NO",
    timestamp
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

/**
 * Replace / Update Nutrition for the given date
 */
function syncNutrition(ss, dateStr, meals, timestamp) {
  var sheet = ss.getSheetByName(SHEETS.NUTRITION);
  var data = sheet.getDataRange().getValues();

  // Delete existing rows for this date to avoid duplicates
  for (var i = data.length - 1; i >= 1; i--) {
    if (normalizeDateString(data[i][0]) === dateStr) {
      sheet.deleteRow(i + 1);
    }
  }

  if (meals.length === 0) return;

  var newRows = [];
  for (var m = 0; m < meals.length; m++) {
    var item = meals[m];
    newRows.push([
      dateStr,
      item.time || Utilities.formatDate(new Date(item.timestamp || Date.now()), Session.getScriptTimeZone(), "hh:mm a"),
      item.name || "Untitled Meal",
      Number(item.kcal || 0),
      Number(item.protein || 0),
      Number(item.carbs || 0),
      Number(item.fat || 0),
      item.source || "manual",
      item.id || ("meal-" + (m + 1)),
      timestamp
    ]);
  }

  if (newRows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

/**
 * Replace / Update Workouts for the given date
 */
function syncWorkouts(ss, dateStr, workouts, timestamp) {
  var sheet = ss.getSheetByName(SHEETS.WORKOUTS);
  var data = sheet.getDataRange().getValues();

  // Delete existing rows for this date
  for (var i = data.length - 1; i >= 1; i--) {
    if (normalizeDateString(data[i][0]) === dateStr) {
      sheet.deleteRow(i + 1);
    }
  }

  var exercises = workouts.exercises || {};
  var activeSplit = workouts.activeSplit || "Upper Body";
  var newRows = [];

  for (var exName in exercises) {
    if (exercises.hasOwnProperty(exName)) {
      var sets = exercises[exName];
      if (Array.isArray(sets)) {
        for (var s = 0; s < sets.length; s++) {
          var setObj = sets[s];
          var weight = Number(setObj.weight || 0);
          var reps = Number(setObj.reps || 0);
          var volume = weight * reps;
          newRows.push([
            dateStr,
            activeSplit,
            exName,
            setObj.set || (s + 1),
            weight,
            reps,
            volume,
            setObj.completed !== false ? "YES" : "NO",
            timestamp
          ]);
        }
      }
    }
  }

  if (newRows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
  }
}

/**
 * Upsert Daily Summary Rollup
 */
function syncSummary(ss, dateStr, day, timestamp) {
  var sheet = ss.getSheetByName(SHEETS.SUMMARY);
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (normalizeDateString(data[i][0]) === dateStr) {
      rowIndex = i + 1;
      break;
    }
  }

  var bio = day.biometrics || {};
  var habits = day.habits || {};
  var meals = day.meals || [];
  var workouts = day.workouts || {};

  var totalKcal = 0;
  var totalProtein = 0;
  var totalCarbs = 0;
  var totalFat = 0;

  for (var m = 0; m < meals.length; m++) {
    totalKcal += Number(meals[m].kcal || 0);
    totalProtein += Number(meals[m].protein || 0);
    totalCarbs += Number(meals[m].carbs || 0);
    totalFat += Number(meals[m].fat || 0);
  }

  var totalTonnage = 0;
  var exercises = workouts.exercises || {};
  for (var ex in exercises) {
    if (exercises.hasOwnProperty(ex)) {
      var sets = exercises[ex];
      if (Array.isArray(sets)) {
        for (var s = 0; s < sets.length; s++) {
          totalTonnage += (Number(sets[s].weight || 0) * Number(sets[s].reps || 0));
        }
      }
    }
  }

  var rowValues = [
    dateStr,
    bio.weight || "",
    totalKcal,
    Math.round(totalProtein * 10) / 10,
    Math.round(totalCarbs * 10) / 10,
    Math.round(totalFat * 10) / 10,
    bio.steps || 0,
    totalTonnage,
    habits.vacuums ? "YES" : "NO",
    timestamp
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

/**
 * Read a single date's complete record from Google Sheets
 */
function readDayData(ss, dateStr) {
  var day = {
    biometrics: { weight: null, subcutaneousFat: null, waistBraced: null, waistRelaxed: null, steps: 0 },
    habits: { vacuums: false },
    meals: [],
    workouts: { activeSplit: "upper", exercises: {} },
    synced: true
  };

  // 1. Biometrics
  var bioSheet = ss.getSheetByName(SHEETS.BIOMETRICS);
  if (bioSheet && bioSheet.getLastRow() > 1) {
    var bioData = bioSheet.getDataRange().getValues();
    for (var i = 1; i < bioData.length; i++) {
      if (normalizeDateString(bioData[i][0]) === dateStr) {
        day.biometrics = {
          weight: bioData[i][1] !== "" ? Number(bioData[i][1]) : null,
          subcutaneousFat: bioData[i][2] !== "" ? Number(bioData[i][2]) : null,
          waistBraced: bioData[i][3] !== "" ? Number(bioData[i][3]) : null,
          waistRelaxed: bioData[i][4] !== "" ? Number(bioData[i][4]) : null,
          steps: Number(bioData[i][5] || 0)
        };
        day.habits = {
          vacuums: bioData[i][6] === "YES"
        };
        break;
      }
    }
  }

  // 2. Nutrition
  var nutSheet = ss.getSheetByName(SHEETS.NUTRITION);
  if (nutSheet && nutSheet.getLastRow() > 1) {
    var nutData = nutSheet.getDataRange().getValues();
    for (var j = 1; j < nutData.length; j++) {
      if (normalizeDateString(nutData[j][0]) === dateStr) {
        day.meals.push({
          id: nutData[j][8] || ("m-" + j),
          time: String(nutData[j][1]),
          name: String(nutData[j][2]),
          kcal: Number(nutData[j][3] || 0),
          protein: Number(nutData[j][4] || 0),
          carbs: Number(nutData[j][5] || 0),
          fat: Number(nutData[j][6] || 0),
          source: String(nutData[j][7] || "manual")
        });
      }
    }
  }

  // 3. Workouts
  var wSheet = ss.getSheetByName(SHEETS.WORKOUTS);
  if (wSheet && wSheet.getLastRow() > 1) {
    var wData = wSheet.getDataRange().getValues();
    for (var k = 1; k < wData.length; k++) {
      if (normalizeDateString(wData[k][0]) === dateStr) {
        var split = String(wData[k][1] || "upper").toLowerCase();
        day.workouts.activeSplit = split.includes("lower") ? "lower" : split.includes("med") || split.includes("full") ? "full" : "upper";
        var exName = String(wData[k][2]);
        if (!day.workouts.exercises[exName]) {
          day.workouts.exercises[exName] = [];
        }
        day.workouts.exercises[exName].push({
          set: Number(wData[k][3] || 1),
          weight: Number(wData[k][4] || 0),
          reps: Number(wData[k][5] || 0),
          completed: wData[k][7] === "YES"
        });
      }
    }
  }

  return day;
}

/**
 * Read ALL historical dates from Google Sheets (Two-Way Cloud Pull)
 */
function readAllDays(ss) {
  var daysMap = {};

  function ensureDayKey(d) {
    if (!daysMap[d]) {
      daysMap[d] = {
        biometrics: { weight: null, subcutaneousFat: null, waistBraced: null, waistRelaxed: null, steps: 0 },
        habits: { vacuums: false },
        meals: [],
        workouts: { activeSplit: "upper", exercises: {} },
        synced: true,
        lastModified: new Date().toISOString()
      };
    }
    return daysMap[d];
  }

  // 1. Biometrics
  var bioSheet = ss.getSheetByName(SHEETS.BIOMETRICS);
  if (bioSheet && bioSheet.getLastRow() > 1) {
    var bioData = bioSheet.getDataRange().getValues();
    for (var i = 1; i < bioData.length; i++) {
      var dStr = normalizeDateString(bioData[i][0]);
      if (dStr) {
        var dayObj = ensureDayKey(dStr);
        dayObj.biometrics = {
          weight: bioData[i][1] !== "" ? Number(bioData[i][1]) : null,
          subcutaneousFat: bioData[i][2] !== "" ? Number(bioData[i][2]) : null,
          waistBraced: bioData[i][3] !== "" ? Number(bioData[i][3]) : null,
          waistRelaxed: bioData[i][4] !== "" ? Number(bioData[i][4]) : null,
          steps: Number(bioData[i][5] || 0)
        };
        dayObj.habits = {
          vacuums: bioData[i][6] === "YES"
        };
      }
    }
  }

  // 2. Nutrition
  var nutSheet = ss.getSheetByName(SHEETS.NUTRITION);
  if (nutSheet && nutSheet.getLastRow() > 1) {
    var nutData = nutSheet.getDataRange().getValues();
    for (var j = 1; j < nutData.length; j++) {
      var dNut = normalizeDateString(nutData[j][0]);
      if (dNut) {
        var dayNut = ensureDayKey(dNut);
        dayNut.meals.push({
          id: nutData[j][8] || ("m-" + j),
          time: String(nutData[j][1]),
          name: String(nutData[j][2]),
          kcal: Number(nutData[j][3] || 0),
          protein: Number(nutData[j][4] || 0),
          carbs: Number(nutData[j][5] || 0),
          fat: Number(nutData[j][6] || 0),
          source: String(nutData[j][7] || "manual")
        });
      }
    }
  }

  // 3. Workouts
  var wSheet = ss.getSheetByName(SHEETS.WORKOUTS);
  if (wSheet && wSheet.getLastRow() > 1) {
    var wData = wSheet.getDataRange().getValues();
    for (var k = 1; k < wData.length; k++) {
      var dW = normalizeDateString(wData[k][0]);
      if (dW) {
        var dayW = ensureDayKey(dW);
        var split = String(wData[k][1] || "upper").toLowerCase();
        dayW.workouts.activeSplit = split.includes("lower") ? "lower" : split.includes("med") || split.includes("full") ? "full" : "upper";
        var exName = String(wData[k][2]);
        if (!dayW.workouts.exercises[exName]) {
          dayW.workouts.exercises[exName] = [];
        }
        dayW.workouts.exercises[exName].push({
          set: Number(wData[k][3] || 1),
          weight: Number(wData[k][4] || 0),
          reps: Number(wData[k][5] || 0),
          completed: wData[k][7] === "YES"
        });
      }
    }
  }

  return daysMap;
}

/**
 * Initialize sheets, structure, styling and freeze panes
 */
function ensureSheetsAndHeaders(ss) {
  var configs = [
    {
      name: SHEETS.BIOMETRICS,
      headers: ["Date", "Weight (kg)", "Subcut Fat (kg)", "Waist Braced (in)", "Waist Relaxed (in)", "Steps", "Stomach Vacuums", "Last Synced"]
    },
    {
      name: SHEETS.NUTRITION,
      headers: ["Date", "Time", "Meal Name", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Source", "Meal ID", "Last Synced"]
    },
    {
      name: SHEETS.WORKOUTS,
      headers: ["Date", "Split", "Exercise", "Set #", "Weight (kg)", "Reps", "Volume (kg)", "Completed", "Last Synced"]
    },
    {
      name: SHEETS.SUMMARY,
      headers: ["Date", "Weight (kg)", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Steps", "Workout Tonnage (kg)", "Vacuums", "Last Synced"]
    }
  ];

  configs.forEach(function(cfg) {
    var sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(cfg.headers);
      var headerRange = sheet.getRange(1, 1, 1, cfg.headers.length);
      headerRange.setBackground("#0f172a");
      headerRange.setFontColor("#22d3ee");
      headerRange.setFontWeight("bold");
      headerRange.setFontFamily("Consolas");
      sheet.setFrozenRows(1);
    }
  });
}

/**
 * Helper to normalize date strings (handling Google Sheet Date objects or YYYY-MM-DD strings)
 */
function normalizeDateString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var str = String(val).trim();
  if (str.length >= 10 && str.charAt(4) === "-" && str.charAt(7) === "-") {
    return str.substring(0, 10);
  }
  return str;
}

/**
 * JSON Response Formatter with CORS Support
 */
function createJsonResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

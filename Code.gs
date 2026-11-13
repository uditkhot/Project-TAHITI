/**
 * ============================================================================
 * PROJECT TAHITI (v2.0) — TELEMETRY & BODY RECOMPOSITION WEBHOOK
 * Google Apps Script Backend (Code.gs)
 * ============================================================================
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open Google Sheets (create a new blank spreadsheet, e.g. "TAHITI Telemetry Matrix").
 * 2. In the menu, go to: Extensions > Apps Script.
 * 3. Delete any default code in Code.gs and paste this entire script.
 * 4. Click the Save icon (💾).
 * 5. Click "Deploy" (top right) > "New deployment".
 * 6. Under "Select type", choose "Web app".
 * 7. Set:
 *    - Description: TAHITI v2.0 Webhook
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (allows PWA fetch without complex OAuth)
 * 8. Click "Deploy", authorize permissions when prompted.
 * 9. Copy the "Web app URL" (starts with https://script.google.com/macros/s/...)
 * 10. Paste this URL into Project TAHITI PWA > Tab 4 (Settings) > Webhook URL.
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
 * Handle HTTP GET Requests (Health Check & Telemetry Pull)
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "ping";
    
    if (action === "ping") {
      return createJsonResponse({
        status: "success",
        code: 200,
        message: "Project TAHITI v2.0 Webhook Operational",
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
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
      message: "TAHITI Webhook Ready. Use POST for telemetry sync."
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
 * Synchronize a single day's record across all 4 sheets
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
    habits.cookOil ? "YES" : "NO",
    habits.cokeZero ? "YES" : "NO",
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

  // Delete existing rows for this date to avoid duplicate records upon multiple syncs
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
  var activeSplit = workouts.activeSplit || "Default Split";
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

  var habitsCompleted = 0;
  if (habits.vacuums) habitsCompleted++;
  if (habits.cookOil) habitsCompleted++;
  if (habits.cokeZero) habitsCompleted++;

  var rowValues = [
    dateStr,
    bio.weight || "",
    totalKcal,
    Math.round(totalProtein * 10) / 10,
    Math.round(totalCarbs * 10) / 10,
    Math.round(totalFat * 10) / 10,
    bio.steps || 0,
    totalTonnage,
    habitsCompleted + "/3",
    timestamp
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

/**
 * Initialize sheets, structure, styling and freeze panes
 */
function ensureSheetsAndHeaders(ss) {
  var configs = [
    {
      name: SHEETS.BIOMETRICS,
      headers: ["Date", "Weight (kg)", "Subcut Fat (kg)", "Waist Braced (in)", "Waist Relaxed (in)", "Steps", "Stomach Vacuums", "Cook Oil <=1tsp", "Coke Zero <=1", "Last Synced"]
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
      headers: ["Date", "Weight (kg)", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Steps", "Workout Tonnage (kg)", "Habits", "Last Synced"]
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

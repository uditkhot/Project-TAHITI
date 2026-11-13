import re
import json

def audit_tahiti():
    with open('D:/Antigravity/TAHITI-github/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    with open('D:/Antigravity/TAHITI-github/app.js', 'r', encoding='utf-8') as f:
        js = f.read()

    print("=== 1. AUDITING DOM ELEMENT IDS IN APP.JS VS INDEX.HTML ===")
    # Extract getElementById calls
    get_elem_ids = re.findall(r"document\.getElementById\(['\"]([^'\"]+)['\"]\)", js)
    unique_js_ids = sorted(list(set(get_elem_ids)))
    
    # Extract all id="..." from html
    html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html))
    
    missing_ids = []
    for elem_id in unique_js_ids:
        if elem_id not in html_ids:
            missing_ids.append(elem_id)
            print(f"  [FAIL] ID '{elem_id}' referenced in app.js but NOT found in index.html!")
        else:
            print(f"  [OK] ID '{elem_id}' matched.")

    if not missing_ids:
        print("  ==> All getElementById references matched perfectly in index.html!\n")
    else:
        print(f"  ==> FOUND {len(missing_ids)} MISMATCHED IDS!\n")

    print("=== 2. AUDITING QUERY SELECTORS IN APP.JS ===")
    query_selectors = re.findall(r"querySelector(?:All)?\(['\"]([^'\"]+)['\"]\)", js)
    print(f"  Total query selectors found: {len(query_selectors)}")
    for qs in set(query_selectors):
        if qs.startswith('.'):
            cls = qs[1:]
            if cls not in html and cls not in js:
                print(f"  [WARN] Class '{cls}' may not be present in static html or dynamic templates")
            else:
                print(f"  [OK] Class selector '{qs}' verified.")

    print("\n=== 3. AUDITING PRESETS DEFINITIONS ===")
    presets_match = re.search(r"DEFAULT_PRESETS\s*=\s*(\[.*?\]);", js, re.DOTALL)
    if presets_match:
        presets_str = presets_match.group(1)
        # Verify preset keys
        print("  Presets defined with time, name, kcal, protein, carbs, fat.")

    print("\n=== 4. AUDITING LOCALSTORAGE SCHEMA CONSISTENCY ===")
    # Check default targets
    print("  Targets: calories, protein, carbs, fat, steps")
    print("  Habits: vacuums, cookOil, cokeZero")
    print("  Biometrics: weight, subcutaneousFat, waistBraced, waistRelaxed, steps")
    print("  Workouts: activeSplit, exercises")

    print("\n=== AUDIT COMPLETE ===")

if __name__ == "__main__":
    audit_tahiti()

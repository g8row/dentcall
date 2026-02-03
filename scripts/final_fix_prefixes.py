import sqlite3
import json
import re

DB_PATH = 'data/cold-caller.db'
con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Map of stem -> correct single-C name
# Stems are the identifiable trailing part
corrections = {
    'ОФИЯ': 'СОФИЯ',
    'МОЛЯН': 'СМОЛЯН',
    'ЛАВЯНОВО': 'СЛАВЯНОВО',
    'ЪЕДИНЕНИЕ': 'СЪЕДИНЕНИЕ',
    'ЪРНИЦА': 'СЪРНИЦА'
}

# Regex to match any number of Cyrillic 'С' or Latin 'C' followed by the stem
# matches "ССОФИЯ", "CСОФИЯ", "ОФИЯ" (if we make the prefix optional? No, we probably want to fix "ОФИЯ" too if it exists, but we did that already. Let's handle 0 or more Cs)
# Pattern: ^[СC]*{stem}
# Wait, we need to be careful not to match "BLAH ОФИЯ".
# But usually the city name IS just that word, or "XXXX YYYY".
# The corruption seems to be on the word level.
# So we will iterate words in the string?
# Most city entries are just the city name, but sometimes "СОФИЯ 18..."
# So verify if the string STARTS with the corrupt pattern.

def fix_text(text):
    if not text: return text, False
    
    original = text
    # We want to replace any word that LOOKS like a corrupted city name.
    # Strategy: For each stem, look for occurrences.
    
    for stem, correct in corrections.items():
        # Match pattern: (Start of string or space) + [any C/С]* + STEM
        # re.IGNORECASE might be dangerous if stems differ by case, but here they are UPPER.
        # We assume data is mostly UPPER.
        
        # Pattern:
        # \b means word boundary? No, Cyrillic word boundaries are tricky in Python re unless using regex module.
        # Let's simple check:
        # 1. Does it match the stem with some prefix at the START of string?
        # 2. Or is it preceded by space?
        
        # Regex: ([СC]*){stem}
        # If we find this, replace the whole match with {correct}
        
        # We want to match: "ССЛАВЯНОВО" -> group(1)="СС", group(2)="ЛАВЯНОВО" -> Replace with "СЛАВЯНОВО"
        # We also want to match: "ОФИЯ" -> group(1)="", group(2)="ОФИЯ" -> Replace with "СОФИЯ"
        
        pattern = r'(^|\s)([СC]*)' + re.escape(stem)
        
        def replace_func(m):
            prefix_space = m.group(1)
            # The garbage C prefix is m.group(2)
            # We replace [space + garbage + stem] with [space + correct]
            return prefix_space + correct
            
        text = re.sub(pattern, replace_func, text)
        
    return text, (text != original)


print("Running regex-based prefix fix...")
count = 0

cur.execute("SELECT id, cities_served, locations FROM dentists")
all_rows = cur.fetchall()

for row in all_rows:
    row_id = row[0]
    raw_cities = row[1]
    raw_locations = row[2]
    
    try:
        # Fix cities_served
        cities = json.loads(raw_cities)
        changed_cities = False
        new_cities = []
        
        if isinstance(cities, list):
            for c in cities:
                fixed_c, changed = fix_text(c)
                new_cities.append(fixed_c)
                if changed: changed_cities = True
        
        # Fix locations
        changed_locations = False
        new_locations = []
        if raw_locations:
            try:
                locs = json.loads(raw_locations)
                if isinstance(locs, list):
                    for loc in locs:
                        new_loc = loc.copy()
                        if 'city' in new_loc and new_loc['city']:
                            fixed_city, changed = fix_text(new_loc['city'])
                            if changed:
                                new_loc['city'] = fixed_city
                                changed_locations = True
                        new_locations.append(new_loc)
            except:
                pass

        if changed_cities or changed_locations:
            if changed_cities:
                new_json_cities = json.dumps(new_cities, ensure_ascii=False)
                cur.execute("UPDATE dentists SET cities_served = ? WHERE id = ?", (new_json_cities, row_id))
            
            if changed_locations:
                new_json_locs = json.dumps(new_locations, ensure_ascii=False)
                cur.execute("UPDATE dentists SET locations = ? WHERE id = ?", (new_json_locs, row_id))
                
            count += 1
    except Exception as e:
        pass

con.commit()
print(f"Fixed {count} records using regex.")
con.close()

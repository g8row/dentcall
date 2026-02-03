import sqlite3
import json

DB_PATH = 'data/cold-caller.db'
con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Known double-corrections to fix
fix_map = [
    ('ССОФИЯ', 'СОФИЯ'),
    ('ССМОЛЯН', 'СМОЛЯН'),
    ('ССЛАВЯНОВО', 'СЛАВЯНОВО'),
    ('ССЪЕДИНЕНИЕ', 'СЪЕДИНЕНИЕ'),
    ('ССЪРНИЦА', 'СЪРНИЦА'),
]

print("Scanning for double-corrected cities...")

cur.execute("SELECT id, cities_served, locations FROM dentists")
all_rows = cur.fetchall()

count = 0

for row in all_rows:
    row_id = row[0]
    raw_cities = row[1]
    raw_locations = row[2]
    
    try:
        # Fix cities_served
        cities = json.loads(raw_cities)
        changed_cities = False
        new_cities = []
        
        def fix_str(s):
            res = s
            was_changed = False
            for bad, good in fix_map:
                if bad in res:
                    res = res.replace(bad, good)
                    was_changed = True
            return res, was_changed

        if isinstance(cities, list):
            for c in cities:
                fixed_c, did_change = fix_str(c)
                new_cities.append(fixed_c)
                if did_change: changed_cities = True
        
        # Fix locations
        changed_locations = False
        new_locations = []
        if raw_locations:
            try:
                locs = json.loads(raw_locations)
                if isinstance(locs, list):
                    for loc in locs:
                        new_loc = loc.copy()
                        # Fix city field
                        if 'city' in new_loc and new_loc['city']:
                            fixed_city, did_change = fix_str(new_loc['city'])
                            if did_change:
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
print(f"Fixed {count} records.")
con.close()

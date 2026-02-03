import sqlite3
import json

DB_PATH = 'data/cold-caller.db'
con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Get all cities
cur.execute("SELECT id, cities_served, locations FROM dentists")
rows = cur.fetchall()

all_cities = set()
for row in rows:
    try:
        cities = json.loads(row[1])
        if isinstance(cities, list):
            for c in cities:
                all_cities.add(c)
        elif isinstance(cities, str):
            all_cities.add(cities)
            
        if row[2]: # Check locations
             locs = json.loads(row[2])
             for l in locs:
                 if 'city' in l and l['city']:
                     all_cities.add(l['city'])
    except:
        pass

# Known valid cities starting with С (extracted from a clean list or heuristic)
# Or easier: Find X where X doesn't start with С, but С+X exists in the set.
truncated_candidates = []
for city in all_cities:
    if city.startswith('С'):
        continue
    
    # Try prepending С
    s_city = 'С' + city
    if s_city in all_cities:
        # Check if length > 3 to avoid noise
        if len(city) > 3:
            truncated_candidates.append((city, s_city))

    # Also check specific known ones like ОФИЯ -> СОФИЯ
    if city.startswith('ОФИЯ'):
         truncated_candidates.append((city, 'С' + city))

# Remove dups
truncated_candidates = list(set(truncated_candidates))

print(f"Found {len(truncated_candidates)} candidate pairs for fixing:")
for bad, good in truncated_candidates:
    print(f"'{bad}' -> '{good}'")

# Apply fixes?
if len(truncated_candidates) > 0:
    print("\nAPPLYING FIXES...")
    count = 0
    cur.execute("SELECT id, cities_served, locations FROM dentists")
    all_rows = cur.fetchall() # Re-fetch to iterate and update
    
    for row in all_rows:
        row_id = row[0]
        raw_cities = row[1]
        raw_locations = row[2] # Now fetching locations too
        
        try:
            # Fix cities_served
            cities = json.loads(raw_cities)
            changed_cities = False
            new_cities = []
            
            # Helper to recursively fix
            def fix_city_str(c_str):
                # 1. Exact match check
                for bad, good in truncated_candidates:
                    if c_str == bad:
                        return good, True
                # 2. Substring match check
                fixed_val = c_str
                was_fixed = False
                for bad, good in truncated_candidates:
                    if bad in fixed_val:
                         fixed_val = fixed_val.replace(bad, good)
                         was_fixed = True
                return fixed_val, was_fixed

            if isinstance(cities, list):
                for c in cities:
                    fixed_c, did_change = fix_city_str(c)
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
                                fixed_city, did_change = fix_city_str(new_loc['city'])
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
            # print(f"Skipping row {row_id}: {e}")
            pass
            
    con.commit()
    print(f"Updated {count} records in database.")
else:
    print("No truncated cities found.")

con.close()

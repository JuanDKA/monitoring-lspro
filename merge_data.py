import json
import re
from datetime import datetime

with open('data_old.json', 'r', encoding='utf-16') as f:
    old_data = json.load(f)

with open('data.json', 'r', encoding='utf-8') as f:
    new_data = json.load(f)

def normalize_name(name):
    name = name.lower()
    name = re.sub(r'^pt\.?\s+', '', name)
    name = re.sub(r'[^a-z0-9]', '', name)
    return name

def merge_sections(section_name):
    old_entries = old_data[section_name]
    new_entries = new_data[section_name]
    
    # Group new entries by kategori
    new_by_kat = {}
    for entry in new_entries:
        kat = entry['kategori']
        if kat not in new_by_kat:
            new_by_kat[kat] = []
        new_by_kat[kat].append(entry)
    
    merged = list(new_entries)
    added_count = 0
    
    for old_entry in old_entries:
        kat = old_entry['kategori']
        # If this category doesn't exist in new data at all, we just keep all old
        # But actually V3 has all categories. Let's just check name by name.
        old_norm = normalize_name(old_entry['nama'])
        
        # Check if this old_norm exists in new_entries for the same kategori
        found = False
        if kat in new_by_kat:
            for new_entry in new_by_kat[kat]:
                if normalize_name(new_entry['nama']) == old_norm:
                    found = True
                    break
        
        if not found:
            # We need to keep the old entry
            print(f"Keeping old entry: {old_entry['nama']} in {section_name} - {kat}")
            merged.append(old_entry)
            added_count += 1
            
    # Sort merged entries by kategori, then by no (if possible) or nama
    # Assign new NO for the merged entries? Actually the UI uses the array order or 'no' field?
    # Let's fix the 'no' field sequentially for each category
    
    final_merged = []
    # Get unique categories
    categories = sorted(list(set(e['kategori'] for e in merged)))
    
    for kat in categories:
        kat_entries = [e for e in merged if e['kategori'] == kat]
        for idx, entry in enumerate(kat_entries, 1):
            entry['no'] = str(idx) + '.' if not str(idx).endswith('.') else str(idx)
            final_merged.append(entry)
            
    return final_merged, added_count

print("Merging LSPro...")
lspro_merged, lspro_added = merge_sections('lspro')
print(f"LSPro added back: {lspro_added}")

print("\nMerging Lab Uji...")
lab_uji_merged, lab_uji_added = merge_sections('lab_uji')
print(f"Lab Uji added back: {lab_uji_added}")

final_data = {
    "lspro": lspro_merged,
    "lab_uji": lab_uji_merged,
    "generated_at": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
}

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(final_data, f, ensure_ascii=False, indent=2)

print(f"\nDone! Saved to data.json")

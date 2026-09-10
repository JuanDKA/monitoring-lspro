import json

with open('data.json', encoding='utf-8') as f:
    d = json.load(f)

with open('dump_utf8.txt', 'w', encoding='utf-8') as out:
    out.write('LSPro records:\n')
    for x in d['lspro']:
        out.write(f"{x['kategori']} - {x['nama']} - {x.get('jangka_waktu')}\n")
    out.write('\nLab Uji records:\n')
    for x in d['lab_uji']:
        out.write(f"{x['kategori']} - {x['nama']} - {x.get('jangka_waktu')}\n")

import json
import pathlib
import sys
import zipfile

rows = []
with zipfile.ZipFile(sys.argv[1]) as archive:
    for line in archive.read('IN.txt').decode().splitlines():
        row = line.split('\t')
        if row[6] != 'P' or not (int(row[14] or 0) >= 500 or row[7].startswith('PPLA') or row[7] == 'PPLC'):
            continue
        rows.append([row[0], row[2] or row[1], float(row[4]), float(row[5]), row[10], int(row[14] or 0), row[3]])
rows.sort(key=lambda row: -row[5])
pathlib.Path('src/data').mkdir(exist_ok=True)
pathlib.Path('src/data/india-cities.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')))
print(f'Imported {len(rows)} Indian cities and towns from GeoNames.')

#!/usr/bin/env python3
"""
Generate Goose SQL migration files for NY county jurisdictions and tax rates.

Outputs:
  ../internal/migrate/migrations/002_seed_jurisdictions.sql
  ../internal/migrate/migrations/003_seed_tax_rates.sql

Run once from the backend/scripts directory (or any directory — paths are relative to this file).
"""

import json
import urllib.request
import os

GEOJSON_URL = "https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json"

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MIGRATIONS_DIR = os.path.join(SCRIPT_DIR, "..", "internal", "migrate", "migrations")

# Authoritative county names — matches getNYCountyNames() in seed.go
NY_COUNTY_NAMES = {
    "36001": "Albany",       "36003": "Allegany",    "36005": "Bronx",
    "36007": "Broome",       "36009": "Cattaraugus", "36011": "Cayuga",
    "36013": "Chautauqua",   "36015": "Chemung",     "36017": "Chenango",
    "36019": "Clinton",      "36021": "Columbia",    "36023": "Cortland",
    "36025": "Delaware",     "36027": "Dutchess",    "36029": "Erie",
    "36031": "Essex",        "36033": "Franklin",    "36035": "Fulton",
    "36037": "Genesee",      "36039": "Greene",      "36041": "Hamilton",
    "36043": "Herkimer",     "36045": "Jefferson",   "36047": "Kings",
    "36049": "Lewis",        "36051": "Livingston",  "36053": "Madison",
    "36055": "Monroe",       "36057": "Montgomery",  "36059": "Nassau",
    "36061": "New York",     "36063": "Niagara",     "36065": "Oneida",
    "36067": "Onondaga",     "36069": "Ontario",     "36071": "Orange",
    "36073": "Orleans",      "36075": "Oswego",      "36077": "Otsego",
    "36079": "Putnam",       "36081": "Queens",      "36083": "Rensselaer",
    "36085": "Richmond",     "36087": "Rockland",    "36089": "St. Lawrence",
    "36091": "Saratoga",     "36093": "Schenectady", "36095": "Schoharie",
    "36097": "Schuyler",     "36099": "Seneca",      "36101": "Steuben",
    "36103": "Suffolk",      "36105": "Sullivan",    "36107": "Tioga",
    "36109": "Tompkins",     "36111": "Ulster",      "36113": "Warren",
    "36115": "Washington",   "36117": "Wayne",       "36119": "Westchester",
    "36121": "Wyoming",      "36123": "Yates",
}

# Sourced from NY DTF Publication 718 (effective March 2025).
# Columns: fips, name, county_rate, city_rate, special_rate, is_mctd
# State rate is always 0.04 and added separately.
STATE_RATE = 0.04
TAX_DATA = [
    ("36001", "Albany",       0.04,    0,       0,       False),
    ("36003", "Allegany",     0.045,   0,       0,       False),
    ("36005", "Bronx",        0,       0.045,   0.00375, True),
    ("36007", "Broome",       0.04,    0,       0,       False),
    ("36009", "Cattaraugus",  0.04,    0,       0,       False),
    ("36011", "Cayuga",       0.04,    0,       0,       False),
    ("36013", "Chautauqua",   0.04,    0,       0,       False),
    ("36015", "Chemung",      0.04,    0,       0,       False),
    ("36017", "Chenango",     0.04,    0,       0,       False),
    ("36019", "Clinton",      0.04,    0,       0,       False),
    ("36021", "Columbia",     0.04,    0,       0,       False),
    ("36023", "Cortland",     0.04,    0,       0,       False),
    ("36025", "Delaware",     0.04,    0,       0,       False),
    ("36027", "Dutchess",     0.0375,  0,       0.00375, True),
    ("36029", "Erie",         0.0475,  0,       0,       False),
    ("36031", "Essex",        0.04,    0,       0,       False),
    ("36033", "Franklin",     0.04,    0,       0,       False),
    ("36035", "Fulton",       0.04,    0,       0,       False),
    ("36037", "Genesee",      0.04,    0,       0,       False),
    ("36039", "Greene",       0.04,    0,       0,       False),
    ("36041", "Hamilton",     0.04,    0,       0,       False),
    ("36043", "Herkimer",     0.04,    0,       0,       False),
    ("36045", "Jefferson",    0.04,    0,       0,       False),
    ("36047", "Kings",        0,       0.045,   0.00375, True),
    ("36049", "Lewis",        0.04,    0,       0,       False),
    ("36051", "Livingston",   0.04,    0,       0,       False),
    ("36053", "Madison",      0.04,    0,       0,       False),
    ("36055", "Monroe",       0.04,    0,       0,       False),
    ("36057", "Montgomery",   0.04,    0,       0,       False),
    ("36059", "Nassau",       0.04250, 0,       0.00375, True),
    ("36061", "New York",     0,       0.045,   0.00375, True),
    ("36063", "Niagara",      0.04,    0,       0,       False),
    ("36065", "Oneida",       0.04,    0,       0,       False),
    ("36067", "Onondaga",     0.04,    0,       0,       False),
    ("36069", "Ontario",      0.035,   0,       0,       False),
    ("36071", "Orange",       0.03750, 0,       0.00375, True),
    ("36073", "Orleans",      0.04,    0,       0,       False),
    ("36075", "Oswego",       0.04,    0,       0,       False),
    ("36077", "Otsego",       0.04,    0,       0,       False),
    ("36079", "Putnam",       0.04,    0,       0.00375, True),
    ("36081", "Queens",       0,       0.045,   0.00375, True),
    ("36083", "Rensselaer",   0.04,    0,       0,       False),
    ("36085", "Richmond",     0,       0.045,   0.00375, True),
    ("36087", "Rockland",     0.04,    0,       0.00375, True),
    ("36089", "St. Lawrence", 0.04,    0,       0,       False),
    ("36091", "Saratoga",     0.03,    0,       0,       False),
    ("36093", "Schenectady",  0.04,    0,       0,       False),
    ("36095", "Schoharie",    0.04,    0,       0,       False),
    ("36097", "Schuyler",     0.04,    0,       0,       False),
    ("36099", "Seneca",       0.04,    0,       0,       False),
    ("36101", "Steuben",      0.04,    0,       0,       False),
    ("36103", "Suffolk",      0.04375, 0,       0.00375, True),
    ("36105", "Sullivan",     0.04,    0,       0,       False),
    ("36107", "Tioga",        0.04,    0,       0,       False),
    ("36109", "Tompkins",     0.04,    0,       0,       False),
    ("36111", "Ulster",       0.04,    0,       0,       False),
    ("36113", "Warren",       0.03,    0,       0,       False),
    ("36115", "Washington",   0.04,    0,       0,       False),
    ("36117", "Wayne",        0.04,    0,       0,       False),
    ("36119", "Westchester",  0.04,    0,       0.00375, True),
    ("36121", "Wyoming",      0.04,    0,       0,       False),
    ("36123", "Yates",        0.04,    0,       0,       False),
]


def sql_str(s):
    """Escape a string for use in a SQL single-quoted literal."""
    return s.replace("'", "''")


def generate_jurisdictions(collection):
    ny = []
    for feature in collection["features"]:
        fips = feature.get("id", "")
        if not fips:
            fips = feature.get("properties", {}).get("GEO_ID", "")
        if not fips.startswith("36"):
            continue
        name = feature.get("properties", {}).get("NAME", "") or NY_COUNTY_NAMES.get(fips, "Unknown")
        geom = json.dumps(feature["geometry"], separators=(",", ":"))
        ny.append((fips, name, geom))

    ny.sort(key=lambda x: x[0])
    print(f"  Found {len(ny)} NY counties")

    lines = [
        "-- +goose Up",
        "-- NY county boundaries (Plotly/Census TIGER GeoJSON, filtered for state FIPS 36).",
        "-- Generated by backend/scripts/gen_seed_migrations.py — do not edit by hand.",
        "",
    ]
    for fips, name, geom in ny:
        lines.append(
            f"INSERT INTO jurisdictions (county_fips, county_name, state_fips, geom) "
            f"VALUES ('{fips}', '{sql_str(name)}', '36', "
            f"ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{sql_str(geom)}'), 4326))) "
            f"ON CONFLICT (county_fips) DO NOTHING;"
        )

    lines += [
        "",
        "-- +goose Down",
        "DELETE FROM jurisdictions;",
    ]
    return "\n".join(lines) + "\n"


def generate_tax_rates():
    lines = [
        "-- +goose Up",
        "-- NY county sales tax rates sourced from NY DTF Publication 718 (effective March 2025).",
        "-- Generated by backend/scripts/gen_seed_migrations.py — do not edit by hand.",
        "",
        "INSERT INTO tax_rates (county_fips, county_name, state_rate, county_rate, city_rate, special_rate, total_rate, is_mctd) VALUES",
    ]

    rows = []
    for fips, name, county, city, special, mctd in TAX_DATA:
        total = round(STATE_RATE + county + city + special, 5)
        mctd_sql = "true" if mctd else "false"
        rows.append(
            f"  ('{fips}', '{sql_str(name)}', "
            f"{STATE_RATE:.5f}, {county:.5f}, {city:.5f}, {special:.5f}, {total:.5f}, {mctd_sql})"
        )

    lines.append(",\n".join(rows))
    lines[-1] += "\nON CONFLICT (county_fips) DO NOTHING;"
    lines += [
        "",
        "-- +goose Down",
        "DELETE FROM tax_rates;",
    ]
    return "\n".join(lines) + "\n"


def main():
    os.makedirs(MIGRATIONS_DIR, exist_ok=True)

    print(f"Downloading GeoJSON from {GEOJSON_URL} ...")
    with urllib.request.urlopen(GEOJSON_URL) as resp:
        collection = json.load(resp)
    print("  Download complete")

    print("Generating 002_seed_jurisdictions.sql ...")
    juris_sql = generate_jurisdictions(collection)
    juris_path = os.path.join(MIGRATIONS_DIR, "002_seed_jurisdictions.sql")
    with open(juris_path, "w") as f:
        f.write(juris_sql)
    print(f"  Written to {juris_path}")

    print("Generating 003_seed_tax_rates.sql ...")
    tax_sql = generate_tax_rates()
    tax_path = os.path.join(MIGRATIONS_DIR, "003_seed_tax_rates.sql")
    with open(tax_path, "w") as f:
        f.write(tax_sql)
    print(f"  Written to {tax_path}")

    print("Done.")


if __name__ == "__main__":
    main()

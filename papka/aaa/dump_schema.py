import sqlite3
conn = sqlite3.connect("quantframeV2.sqlite")
cur = conn.cursor()
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")
for row in cur.fetchall():
    print(f"=== {row[0]} ===")
    print(row[1])
    print()
conn.close()

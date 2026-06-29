import sqlite3
conn = sqlite3.connect("quantframeV2.sqlite")
cur = conn.cursor()
cur.execute('SELECT DISTINCT tags FROM "transaction"')
for r in cur.fetchall():
    print(r[0])
print("---")
cur.execute('SELECT DISTINCT tags FROM "transaction"')
tags = set()
for r in cur.fetchall():
    for t in r[0].split(","):
        tags.add(t.strip())
for t in sorted(tags):
    print(t)
conn.close()

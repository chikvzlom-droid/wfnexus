import sqlite3
conn = sqlite3.connect("quantframeV2.sqlite")
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Show transactions count + sample
cur.execute('SELECT COUNT(*) as cnt FROM "transaction"')
print(f"Transactions: {cur.fetchone()['cnt']}")
cur.execute('SELECT * FROM "transaction" ORDER BY id DESC LIMIT 3')
for r in cur.fetchall():
    print(dict(r))

print()

cur.execute("SELECT COUNT(*) as cnt FROM stock_item")
print(f"Stock items: {cur.fetchone()['cnt']}")
cur.execute("SELECT * FROM stock_item ORDER BY id DESC LIMIT 3")
for r in cur.fetchall():
    print(dict(r))

print()

# Show trade_entry
cur.execute("SELECT COUNT(*) as cnt FROM trade_entry")
print(f"Trade entries: {cur.fetchone()['cnt']}")
cur.execute("SELECT * FROM trade_entry LIMIT 5")
for r in cur.fetchall():
    print(dict(r))

print()

# Show setting table
cur.execute("SELECT * FROM setting")
for r in cur.fetchall():
    print(dict(r))

conn.close()

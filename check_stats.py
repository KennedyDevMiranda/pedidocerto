import sqlite3
conn = sqlite3.connect(r'\\100.104.17.8\DevMiranda_2\devmiranda.db')
c = conn.cursor()

c.execute('SELECT COUNT(*) FROM Pedidos')
print(f'Total Pedidos: {c.fetchone()[0]}')

c.execute('SELECT COUNT(DISTINCT ClienteId) FROM Pedidos')
print(f'Total Clientes: {c.fetchone()[0]}')

c.execute('SELECT COUNT(*), AVG(Nota) FROM Feedbacks')
fb = c.fetchone()
print(f'Total Feedbacks: {fb[0]}, Media: {fb[1]}')

c.execute("PRAGMA table_info(Feedbacks)")
cols = c.fetchall()
print('--- Colunas Feedbacks ---')
for col in cols:
    print(f'  {col[1]} ({col[2]})')

col_names = [col[1] for col in cols]
c.execute("SELECT * FROM Feedbacks ORDER BY Id DESC LIMIT 5")
rows = c.fetchall()
print('--- Feedbacks recentes ---')
for r in rows:
    d = dict(zip(col_names, r))
    nome = d.get('NomeExibicao') or d.get('NomeCliente') or 'N/A'
    com = (d.get('Comentario') or '')[:60]
    nota = d.get('Nota', '?')
    print(f'  {nome}: nota={nota}, "{com}"')

# Tables
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
print('--- Tabelas ---')
for r in c.fetchall():
    print(f'  {r[0]}')

c.execute("SELECT c.Nome, COUNT(p.Id) as pedidos FROM Clientes c LEFT JOIN Pedidos p ON p.ClienteId = c.Id GROUP BY c.Id ORDER BY pedidos DESC LIMIT 10")
print('--- Clientes top ---')
for r in c.fetchall():
    print(f'  {r[0]}: {r[1]} pedidos')

c.execute("SELECT f.Nota, f.Comentario, c.Nome, f.DataCriacao FROM Feedbacks f LEFT JOIN Clientes c ON c.Id = f.ClienteId ORDER BY f.Id DESC LIMIT 5")
print('--- Feedbacks com nomes ---')
for r in c.fetchall():
    print(f'  {r[2] or "Anon"}: nota={r[0]}, "{(r[1] or "")[:50]}", data={r[3]}')

conn.close()
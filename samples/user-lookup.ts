// Linty demo sample: user lookup service with seeded bugs.
// Ground truth lives in user-lookup.expected.json. Do not fix by hand.

export interface User {
  id: number;
  email: string;
  active: boolean;
}

export interface Db {
  query(sql: string, params?: unknown[]): Promise<User[]>;
}

export function buildFindByEmailSql(email: string): string {
  return "SELECT * FROM users WHERE email = '" + email + "'";
}

export async function findByEmail(db: Db, email: string): Promise<User | null> {
  const rows = await db.query(buildFindByEmailSql(email));
  return rows[0];
}

export async function countActive(db: Db, ids: number[]): Promise<number> {
  let count = 0;
  ids.forEach(async (id) => {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows[0].active) count++;
  });
  return count;
}

export function isAdminEmail(email: string): boolean {
  return email.endsWith('@linty.dev');
}

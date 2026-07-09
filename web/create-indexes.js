// One-time script to create the unique indexes needed before launch.
// Run from the `web/` folder:  node create-indexes.js
// Safe to re-run (createIndex is idempotent). Auto-creates collections if missing.

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load MONGODB_URI / MONGODB_DB from .env.local or .env (no dotenv needed)
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}
loadEnv();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'test';
if (!uri) {
  console.error('MONGODB_URI not found in .env.local / .env — run this from the web/ folder.');
  process.exit(1);
}

const INDEXES = [
  ['reactions', { scope: 1, messageId: 1, emoji: 1 }, { unique: true }],
  ['mvpVotes', { matchId: 1, voterId: 1 }, { unique: true }],
  ['referrals', { referredId: 1 }, { unique: true }],
  ['paypalOrders', { orderId: 1 }, { unique: true }],
  ['sanctions', { discordId: 1 }, {}], // non-unique, just for lookup speed
];

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`\nConnected to database: ${dbName}\n`);
    for (const [coll, spec, opts] of INDEXES) {
      try {
        const name = await db.collection(coll).createIndex(spec, opts);
        console.log(`  OK   ${coll}  ->  ${name}${opts.unique ? '  (unique)' : ''}`);
      } catch (e) {
        console.log(`  FAIL ${coll}  ->  ${e.message}`);
        if (String(e.message).includes('duplicate key')) {
          console.log(`       ^ this collection has duplicate data; tell me and I'll help you clean it.`);
        }
      }
    }
    console.log('\nDone. You can re-run this anytime — it will not create duplicates.\n');
  } catch (e) {
    console.error('Connection error:', e.message);
    process.exit(1);
  } finally {
    await client.close();
  }
})();

// Usage counts from the `frisp_usage` Analytics Engine dataset, the one the
// Worker (src/edge/worker.ts) writes: `npm run stats`, or
// `npm run stats -- --days 7`. Reads CLOUDFLARE_API_TOKEN (needs Account
// Analytics Read) and CLOUDFLARE_ACCOUNT_ID, falling back to the first account
// the token can see. Columns: blob1 = event, blob2 = value, blob3 = country.
// Counts use SUM(_sample_interval) because Analytics Engine samples at volume.
const DATASET = 'frisp_usage';
const API = 'https://api.cloudflare.com/client/v4';

function stop(message) {
  console.error(`stats: ${message}`);
  process.exit(1);
}

const daysArg = process.argv.indexOf('--days');
const days = daysArg === -1 ? 30 : Number(process.argv[daysArg + 1]);
if (!Number.isInteger(days) || days < 1) stop('--days needs a whole number.');

const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) stop('set CLOUDFLARE_API_TOKEN to query Analytics Engine.');
const headers = { Authorization: `Bearer ${token}` };

async function accountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID)
    return process.env.CLOUDFLARE_ACCOUNT_ID;
  const response = await fetch(`${API}/accounts?per_page=1`, { headers });
  const body = await response.json().catch(() => null);
  const id = body?.result?.[0]?.id;
  if (!id) stop('the token lists no account; set CLOUDFLARE_ACCOUNT_ID.');
  return id;
}

async function query(account, sql) {
  const response = await fetch(
    `${API}/accounts/${account}/analytics_engine/sql`,
    { method: 'POST', headers, body: `${sql} FORMAT JSON` },
  );
  const text = await response.text();
  if (!response.ok) {
    if (/unknown table|does not exist/i.test(text)) return [];
    stop(
      `the SQL API answered ${response.status}: ${text.trim().slice(0, 200)}`,
    );
  }
  return JSON.parse(text).data ?? [];
}

function table(rows, columns) {
  const widths = columns.map((column) =>
    Math.max(column.length, ...rows.map((row) => String(row[column]).length)),
  );
  const line = (cells) =>
    cells.map((cell, i) => String(cell).padEnd(widths[i])).join('  ');
  console.log(line(columns));
  for (const row of rows) console.log(line(columns.map((c) => row[c])));
}

const account = await accountId();
const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;

const perDay = await query(
  account,
  `SELECT formatDateTime(toStartOfDay(timestamp), '%Y-%m-%d') AS day,
     SUM(_sample_interval) AS sessions
   FROM ${DATASET} WHERE ${since} AND blob1 = 'session'
   GROUP BY day ORDER BY day`,
);
const events = await query(
  account,
  `SELECT blob1 AS event, blob2 AS value, SUM(_sample_interval) AS count
   FROM ${DATASET} WHERE ${since}
   GROUP BY event, value ORDER BY event, count DESC`,
);

if (events.length === 0) {
  console.log(`No usage events in the last ${days} days.`);
  process.exit(0);
}

console.log(`Sessions per day, last ${days} days\n`);
if (perDay.length) table(perDay, ['day', 'sessions']);
else console.log('(no sessions)');

const byEvent = Map.groupBy(events, (row) => row.event);
for (const [event, rows] of byEvent) {
  console.log(`\n${event}`);
  table(rows, ['value', 'count']);
}

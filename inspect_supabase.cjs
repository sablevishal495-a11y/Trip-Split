const fs = require('fs');
const path = require('path');

// Read Supabase credentials from src/lib/supabase.ts
const supabaseTs = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'supabase.ts'), 'utf8');

const urlMatch = supabaseTs.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supabaseTs.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
  console.log('Could not parse SUPABASE_URL or SUPABASE_ANON_KEY from src/lib/supabase.ts');
  console.log('Contents of supabase.ts:\n', supabaseTs);
  process.exit(1);
}

const supabaseUrl = urlMatch[1];
const supabaseKey = keyMatch[1];

console.log('Supabase URL:', supabaseUrl);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDb() {
  console.log('\n--- 1. Expenses Table ---');
  const { data: exps, error: eErr } = await supabase.from('expenses').select('*').limit(5);
  if (eErr) console.error('Error fetching expenses:', eErr);
  else console.log(JSON.stringify(exps, null, 2));

  console.log('\n--- 2. Contributions Table ---');
  const { data: contribs, error: cErr } = await supabase.from('contributions').select('*').limit(5);
  if (cErr) console.error('Error fetching contributions:', cErr);
  else console.log(JSON.stringify(contribs, null, 2));

  console.log('\n--- 3. Trips Table ---');
  const { data: trips, error: tErr } = await supabase.from('trips').select('*').limit(5);
  if (tErr) console.error('Error fetching trips:', tErr);
  else console.log(JSON.stringify(trips, null, 2));
}

inspectDb().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
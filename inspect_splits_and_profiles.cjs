const fs = require('fs');
const path = require('path');

const supabaseTs = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'supabase.ts'), 'utf8');
const urlMatch = supabaseTs.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supabaseTs.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkMore() {
  console.log('--- 1. Expense Splits ---');
  const { data: s, error: sErr } = await supabase.from('expense_splits').select('*').limit(5);
  if (sErr) console.error('Splits error:', sErr);
  else console.log(JSON.stringify(s, null, 2));

  console.log('\n--- 2. Profiles ---');
  const { data: p, error: pErr } = await supabase.from('profiles').select('*').limit(5);
  if (pErr) console.error('Profiles error:', pErr);
  else console.log(JSON.stringify(p, null, 2));

  console.log('\n--- 3. Invitations or Invite Codes ---');
  const { data: inv, error: iErr } = await supabase.from('invitations').select('*').limit(5);
  if (iErr) console.error('Invitations error (if table exists):', iErr);
  else console.log(JSON.stringify(inv, null, 2));
}

checkMore().then(() => process.exit(0));
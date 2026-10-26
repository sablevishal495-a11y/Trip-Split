const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
const content = fs.readFileSync(queriesPath, 'utf8');

console.log('=== Exported items in src/lib/queries.ts ===');
const exports = content.match(/export\s+(function|const|type|interface)\s+([a-zA-Z0-9_]+)/g);
if (exports) {
  exports.forEach(e => console.log('  ', e));
} else {
  console.log('No exports found matching regex');
}
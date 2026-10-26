const fs = require('fs');
const path = require('path');

function searchAll(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchAll(fullPath);
      }
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('expenses') && (content.includes('paise') || content.includes('CREATE TABLE') || content.includes('Table'))) {
        console.log(`\n=== File: ${fullPath} ===`);
        const lines = content.split('\n');
        lines.forEach((l, i) => {
          if (l.includes('expenses') || l.includes('paise') || l.includes('amount') || l.includes('COLUMN') || l.includes('table')) {
            console.log(`Line ${i + 1}: ${l.trim()}`);
          }
        });
      }
    }
  }
}

searchAll(process.cwd());
const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchFiles(fullPath);
    } else {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('amount') || content.includes('paise') || content.includes('expenses')) {
        console.log(`\n--- ${fullPath} ---`);
        const lines = content.split('\n');
        lines.forEach((l, i) => {
          if (l.includes('paise') || l.includes('amount') || l.includes('insert') || l.includes('select')) {
            console.log(`Line ${i+1}: ${l.trim()}`);
          }
        });
      }
    }
  }
}

searchFiles(path.join(process.cwd(), 'src'));
const fs = require('fs');
const path = require('path');

function searchDir(dir, keyword) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDir(fullPath, keyword);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.sql')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(keyword)) {
        console.log(`\n=== Found "${keyword}" in: ${fullPath} ===`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('expenses') || line.includes('amount') || line.includes('paise')) {
            console.log(`  Line ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchDir(path.join(process.cwd(), 'src'), 'expenses');
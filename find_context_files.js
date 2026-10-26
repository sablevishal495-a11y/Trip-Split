const fs = require('fs');
const path = require('path');

function listDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      listDir(fullPath);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('supabase.auth') || content.includes('useSession') || content.includes('UserContext') || content.includes('SessionContext')) {
          console.log(`Found auth keyword in: ${fullPath}`);
        }
      }
    }
  }
}

console.log('--- Searching files in src/ for auth context ---');
listDir(path.join(process.cwd(), 'src'));
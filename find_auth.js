const fs = require('fs');
const path = require('path');

function searchFile(dir, fileName) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const found = searchFile(fullPath, fileName);
      if (found) return found;
    } else if (file.toLowerCase().includes(fileName.toLowerCase())) {
      return fullPath;
    }
  }
  return null;
}

const authPath = searchFile(path.join(process.cwd(), 'src'), 'AuthContext');
if (authPath) {
  console.log('Found AuthContext at:', authPath);
  // Calculate relative path from src/screens/main/TripDetailScreen.tsx
  // TripDetailScreen is at src/screens/main/TripDetailScreen.tsx
  const relative = path.relative(path.join(process.cwd(), 'src', 'screens', 'main'), authPath);
  // Normalize windows separators and strip extension
  let importPath = relative.replace(/\\/g, '/').replace(/\.tsx?$/, '');
  if (!importPath.startsWith('.')) {
    importPath = './' + importPath;
  }
  console.log('Import path should be:', importPath);

  // Update TripDetailScreen
  const detailPath = path.join(process.cwd(), 'src', 'screens', 'main', 'TripDetailScreen.tsx');
  let content = fs.readFileSync(detailPath, 'utf8');
  content = content.replace(/import \{ useAuth \} from '.*';/, `import { useAuth } from '${importPath}';`);
  fs.writeFileSync(detailPath, content);
  console.log('✅ Updated TripDetailScreen.tsx with correct AuthContext path!');
} else {
  console.log('❌ AuthContext file not found.');
}
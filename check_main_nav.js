const fs = require('fs');
const path = require('path');

const navPath = path.join(process.cwd(), 'src', 'navigation', 'MainNavigator.tsx');
if (fs.existsSync(navPath)) {
  const content = fs.readFileSync(navPath, 'utf8');
  console.log('=== MainNavigator.tsx Imports ===');
  console.log(content.split('\n').slice(0, 30).join('\n'));
} else {
  console.log('MainNavigator.tsx not found');
}
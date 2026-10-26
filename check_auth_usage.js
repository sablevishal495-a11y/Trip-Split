const fs = require('fs');
const path = require('path');

const dashPath = path.join(process.cwd(), 'src', 'screens', 'main', 'DashboardScreen.tsx');
if (fs.existsSync(dashPath)) {
  const content = fs.readFileSync(dashPath, 'utf8');
  console.log('=== Top 30 lines of DashboardScreen.tsx ===');
  console.log(content.split('\n').slice(0, 35).join('\n'));
} else {
  console.log('DashboardScreen not found');
}
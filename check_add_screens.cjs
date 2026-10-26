const fs = require('fs');
const path = require('path');

const read = (rel) => {
  const p = path.join(process.cwd(), rel);
  if (fs.existsSync(p)) {
    console.log('\n==================== ' + rel + ' ====================');
    console.log(fs.readFileSync(p, 'utf8'));
  } else {
    console.log('\n!! File not found: ' + rel);
  }
};

read('src/screens/main/AddExpenseScreen.tsx');
read('src/screens/main/AddContributionScreen.tsx');
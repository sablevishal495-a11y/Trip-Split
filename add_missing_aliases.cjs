const fs = require('fs');
const path = require('path');

const queriesPath = path.join(process.cwd(), 'src', 'lib', 'queries.ts');
let content = fs.readFileSync(queriesPath, 'utf8');

// Ensure useRecordExpense and other aliases are exported
const aliases = `
export const useRecordExpense = useRecordContribution;
export const useAddExpense = useRecordContribution;
export const useAddContribution = useRecordContribution;
`;

if (!content.includes('export const useRecordExpense')) {
  content += '\n' + aliases;
  fs.writeFileSync(queriesPath, content, 'utf8');
  console.log('✅ Added export const useRecordExpense alias to queries.ts');
} else {
  console.log('ℹ️ useRecordExpense already exported');
}
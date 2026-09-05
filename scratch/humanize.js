const fs = require('fs');
const path = require('path');

const filesToHumanize = [
  'server.js',
  'src/app/auth.css',
  'src/app/welcome/welcome.css',
  'src/lib/ai-engine.ts',
  'src/lib/event-bus.ts',
  'src/lib/live-simulator.ts',
  'src/lib/reconciliation-engine.ts',
  'src/lib/seed.ts',
  'src/lib/types.ts'
];

for (const file of filesToHumanize) {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove lines with lots of equals signs like // ======================= or /* ============= */
  content = content.replace(/^[ \t]*(\/\/|\/\*)?[ \t]*={10,}[ \t]*(\*\/)?\r?\n/gm, '');
  
  // Remove block title lines starting with // RazorRecon AI
  content = content.replace(/^[ \t]*\/\/[ \t]*RazorRecon AI.*?\r?\n/gm, '');
  
  // Remove overly descriptive subtitle lines
  content = content.replace(/^[ \t]*\/\/[ \t]*Centralized interfaces for the deterministic engine.*?\r?\n/gm, '');
  content = content.replace(/^[ \t]*\/\/[ \t]*Deterministic, auditable, no external API dependency.*?\r?\n/gm, '');
  content = content.replace(/^[ \t]*\/\/[ \t]*Processes batches of transactions against canonical datasets.*?\r?\n/gm, '');
  content = content.replace(/^[ \t]*\/\/[ \t]*Typed channels, subscriber management, event replay buffer.*?\r?\n/gm, '');
  
  // Replace layer comments to look normal
  content = content.replace(/(\/\/ ============ )LAYER (\d): (.*?) ============/g, '// Layer $2: $3');

  // CSS replacements
  content = content.replace(/\/\* ============================================================ \*\/\r?\n/g, '');
  content = content.replace(/\/\* RazorRecon AI.*?\r?\n/g, '');
  content = content.replace(/\/\* Auth Layout.*?\r?\n/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Humanized files.');

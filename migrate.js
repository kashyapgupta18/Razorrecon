const fs = require('fs');
const path = require('path');

const filesToMigrate = [
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\money-flow\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\matches\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\exceptions\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\ai-copilot\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\transactions\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\dashboard\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\system\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\benchmark\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\simulator\\route.ts',
  'd:\\AI Finance\\razorrecon\\src\\app\\api\\seed\\route.ts'
];

for (const file of filesToMigrate) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace db.prepare('query').all(args) -> (await db.query('query', [args])).rows
  // Regex needs to handle multiline template literals
  
  // A general purpose replacement for .all()
  content = content.replace(/db\.prepare\((['"`])([\s\S]*?)\1\)\.all\((.*?)\)/g, (match, quote, query, args) => {
    let replacedQuery = query;
    let i = 1;
    replacedQuery = replacedQuery.replace(/\?/g, () => `$${i++}`);
    return `(await db.query(${quote}${replacedQuery}${quote}${args.trim() ? `, [${args}]` : ''})).rows`;
  });

  // A general purpose replacement for .get()
  content = content.replace(/db\.prepare\((['"`])([\s\S]*?)\1\)\.get\((.*?)\)/g, (match, quote, query, args) => {
    let replacedQuery = query;
    let i = 1;
    replacedQuery = replacedQuery.replace(/\?/g, () => `$${i++}`);
    return `(await db.query(${quote}${replacedQuery}${quote}${args.trim() ? `, [${args}]` : ''})).rows[0]`;
  });

  // A general purpose replacement for .run()
  content = content.replace(/db\.prepare\((['"`])([\s\S]*?)\1\)\.run\((.*?)\)/g, (match, quote, query, args) => {
    let replacedQuery = query;
    let i = 1;
    replacedQuery = replacedQuery.replace(/\?/g, () => `$${i++}`);
    return `await db.query(${quote}${replacedQuery}${quote}${args.trim() ? `, [${args}]` : ''})`;
  });

  fs.writeFileSync(file, content, 'utf8');
  console.log(`Migrated ${file}`);
}

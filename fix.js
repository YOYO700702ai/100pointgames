const fs = require('fs');
let t = fs.readFileSync('nextjs-rpg/src/app/page.js', 'utf8');
t = t.split('\\`}').join('`}');
fs.writeFileSync('nextjs-rpg/src/app/page.js', t);

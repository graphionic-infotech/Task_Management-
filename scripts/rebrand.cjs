const fs = require('fs');
const path = require('path');

const localesDir = path.resolve(__dirname, '../packages/core/src/i18n/locales');
for (const file of fs.readdirSync(localesDir)) {
    if (file.endsWith('.ts')) {
        const p = path.join(localesDir, file);
        let content = fs.readFileSync(p, 'utf8');
        content = content.replace(/'app\.name':\s*'Mindwtr'/g, "'app.name': 'Graphionic'");
        fs.writeFileSync(p, content, 'utf8');
    }
}
console.log('Successfully updated app.name across all locales to Graphionic');

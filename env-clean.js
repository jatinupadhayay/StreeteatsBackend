const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    const seenKeys = new Set();
    const newLines = [];
    let cleaned = false;

    for (let line of lines) {
        const match = line.match(/^([^#=]+)=/);
        if (match) {
            const key = match[1].trim();
            if (seenKeys.has(key)) {
                console.log(`Removing duplicate key: ${key}`);
                cleaned = true;
                continue; // Skip this duplicate line
            }
            seenKeys.add(key);
        }
        newLines.push(line);
    }

    if (cleaned) {
        fs.writeFileSync(envPath, newLines.join('\n'));
        console.log("SUCCESS: .env file cleaned of duplicates.");
    } else {
        console.log("No duplicates found to clean.");
    }
} else {
    console.log(".env file not found.");
}

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'emps.json');
try {
    const data = fs.readFileSync(filePath, 'utf16le');
    console.log(data);
} catch (e) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        console.log(data);
    } catch (e2) {
        console.error('Failed to read file:', e2);
    }
}

const fs = require('fs');
const fetch = require('node-fetch');

async function test() {
    try {
        const adminId = "admin-uuid-001";

        const loginRes2 = await fetch('http://localhost:3001/api/v1/auth/test-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: adminId, roleId: 'ADMIN' })
        }).then(r => r.json());

        const token = loginRes2.data?.access_token || loginRes2.access_token;
        if (!token) throw new Error("No token returned");

        const formData = {
            title: 'Test Rule via script',
            description: 'Test Rule Desc',
            category: 'HR',
            priority: 'Normal'
        };

        const r = await fetch('http://localhost:3001/api/v1/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(formData)
        });
        const j = await r.json();
        fs.writeFileSync('output.json', JSON.stringify({ status: r.status, body: j }, null, 2));
        console.log("Done");
    } catch (err) {
        fs.writeFileSync('output.json', JSON.stringify({ error: err.toString(), stack: err.stack }, null, 2));
    }
}
test();

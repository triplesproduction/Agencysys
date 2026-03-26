const fs = require('fs');
const fetch = require('node-fetch');

async function test() {
    try {
        const dummyAdminId = "11111111-1111-1111-1111-111111111111"; // Real UUID format

        const loginRes2 = await fetch('http://localhost:3001/api/v1/auth/test-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: dummyAdminId, roleId: 'ADMIN' })
        }).then(r => r.json());

        const token = loginRes2.data?.access_token || loginRes2.access_token;
        if (!token) throw new Error("No token returned");

        const formData = {
            title: 'Test',
            description: 'Test Desc',
            assigneeIds: [dummyAdminId],
            priority: 'LOW',
            dueDate: '2026-03-03T00:00:00.000Z',
            instructions: 'sdsd vfvf ffvfv',
            attachments: ['https://youtube']
        };

        const r = await fetch('http://localhost:3001/api/v1/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify(formData)
        });
        const j = await r.json();
        fs.writeFileSync('output.json', JSON.stringify({ status: r.status, body: j }, null, 2));
    } catch (err) {
        fs.writeFileSync('output.json', JSON.stringify({ error: err.toString(), stack: err.stack }, null, 2));
    }
}
test();

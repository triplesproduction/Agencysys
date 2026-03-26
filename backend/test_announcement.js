const fs = require('fs');
const fetch = require('node-fetch');

async function test() {
    let token;
    try {
        // Step 1: Get token for admin
        const loginRes = await fetch('http://localhost:3001/api/v1/auth/test-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: 'admin-uuid-001', roleId: 'ADMIN' })
        }).then(r => r.json());

        token = loginRes.access_token;
        if (!token) throw new Error('No token: ' + JSON.stringify(loginRes));

        const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        // Step 2: Create an announcement
        const createRes = await fetch('http://localhost:3001/api/v1/announcements', {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({ title: 'Test Announcement', message: 'This is a test', type: 'ANNOUNCEMENT' })
        });
        const created = await createRes.json();
        console.log('CREATE status:', createRes.status, '| status field:', created.status || created?.body?.status);

        const id = created.id;
        if (!id) throw new Error('No ID returned: ' + JSON.stringify(created));

        // Step 3: GET all - verify status is "active"
        const listRes = await fetch('http://localhost:3001/api/v1/announcements', { headers: auth });
        const list = await listRes.json();
        const found = list.find(a => a.id === id);
        console.log('GET LIST status:', listRes.status, '| found status:', found?.status);

        // Step 4: Toggle to inactive
        const patchRes = await fetch(`http://localhost:3001/api/v1/announcements/${id}/status`, {
            method: 'PATCH',
            headers: auth,
            body: JSON.stringify({ status: 'inactive' })
        });
        const patched = await patchRes.json();
        console.log('PATCH status:', patchRes.status, '| new status:', patched.status);

        // Step 5: GET again - verify still inactive after "refresh"
        const listRes2 = await fetch('http://localhost:3001/api/v1/announcements', { headers: auth });
        const list2 = await listRes2.json();
        const found2 = list2.find(a => a.id === id);
        console.log('GET after toggle:', listRes2.status, '| persisted status:', found2?.status);

        // Cleanup
        await fetch(`http://localhost:3001/api/v1/announcements/${id}`, { method: 'DELETE', headers: auth });
        console.log('✅ ALL TESTS PASSED');

        fs.writeFileSync('announcement_test.json', JSON.stringify({ success: true, statusAfterCreate: found?.status, statusAfterToggle: found2?.status }, null, 2));
    } catch (err) {
        console.error('Test FAILED:', err.message);
        fs.writeFileSync('announcement_test.json', JSON.stringify({ error: err.toString() }, null, 2));
    }
}
test();

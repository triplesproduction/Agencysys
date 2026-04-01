const http = require('http');

const runTest = async () => {
    // 1. Get Admin Token
    const loginPayload = JSON.stringify({ employeeId: 'admin-emp', roleId: 'ADMIN' });
    const token = await new Promise((resolve, reject) => {
        const req = http.request(
            { hostname: 'localhost', port: 3000, path: '/api/v1/auth/test-login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data).access_token));
            }
        );
        req.write(loginPayload);
        req.end();
    });
    console.log('Got Admin Token:', token.substring(0, 15) + '...');

    // 2. Send Encrypted Message
    const msgPayload = JSON.stringify({ senderId: 'emp-101', receiverId: 'emp-102', content: 'SECRET AGENCY LAUNCH CODES: 994-Alpha' });
    await new Promise((resolve) => {
        const req = http.request(
            { hostname: 'localhost', port: 3000, path: '/api/v1/chats/send', method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => { console.log('Message Sent:', data); resolve(); });
            }
        );
        req.write(msgPayload);
        req.end();
    });

    // 3. Admin Global Read (Triggers Audit)
    await new Promise((resolve) => {
        const req = http.request(
            { hostname: 'localhost', port: 3000, path: '/api/v1/chats/admin', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const parsed = JSON.parse(data);
                    console.log('\n--- ADMIN FEED FETCH ---');
                    console.log(`Found ${parsed.data.length} messages.`);
                    if (parsed.data.length > 0) {
                        console.log('Latest Decrypted Content:', parsed.data[0].content);
                        console.log('Raw ID:', parsed.data[0].id);
                    }
                    resolve();
                });
            }
        );
        req.end();
    });

    // 4. Verify Audit Log was generated
    await new Promise((resolve) => {
        const req = http.request(
            { hostname: 'localhost', port: 3000, path: '/api/v1/activity/admin-emp', method: 'GET', headers: { 'Authorization': `Bearer ${token}` } },
            (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const parsed = JSON.parse(data);
                    console.log('\n--- ASTOUNDING AUDIT TRAIL ---');
                    console.log(parsed.data.slice(0, 2).map(log => `[${log.action}] ${log.metadata}`));
                    resolve();
                });
            }
        );
        req.end();
    });
};

runTest().catch(console.error);

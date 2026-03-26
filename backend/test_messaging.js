
async function testSendMessage() {
    const baseURL = 'http://localhost:3001/api/v1';
    try {
        // 1. Get Token
        const loginRes = await fetch(`${baseURL}/auth/test-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeId: 'admin-uuid-001',
                roleId: 'ADMIN'
            })
        });
        const loginData = await loginRes.json();
        const token = loginData.access_token;

        // 2. Send Message
        await fetch(`${baseURL}/chats/send`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                receiverId: 'worker-uuid-002',
                content: 'Hello, testing!'
            })
        });

        // 3. Get My Chats
        const getRes = await fetch(`${baseURL}/chats/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const text = await getRes.text();
        console.log('Get My Chats Response Status:', getRes.status);
        console.log('Get My Chats Raw Response:', text.substring(0, 1000));

    } catch (err) {
        console.error('Test Script Error:', err.message);
    }
}

testSendMessage();

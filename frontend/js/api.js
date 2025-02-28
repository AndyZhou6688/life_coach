const API_BASE_URL = 'http://localhost:3001';

async function fetchChatHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/history`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error fetching chat history:', error);
        throw error;
    }
}

async function sendChatMessage(message) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}
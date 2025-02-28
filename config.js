require('dotenv').config();

const config = {
    api: {
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_KEY}`
        },
        model: 'deepseek-r1-250120',
        temperature: 0.6,
        timeout: 60000 // 60秒超时
    }
};

module.exports = config;
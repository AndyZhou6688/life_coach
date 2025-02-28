const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const fetch = require('node-fetch');

// 创建数据存储目录
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// 对话历史文件路径
const HISTORY_FILE = path.join(DATA_DIR, 'chat_history.json');

// 初始化对话历史
if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}

// 系统消息模板
const SYSTEM_MESSAGE = `你是一位专业的生活教练，名为DeepSeek教练。你的目标是通过对话帮助用户成长和进步。请：
1. 认真倾听用户的问题和困扰
2. 提供有建设性且实用的建议
3. 保持积极鼓励的态度
4. 根据用户的情绪状态调整回应风格
5. 引导用户进行自我反思`;

// MIME类型映射
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// 简单的情绪分析函数
function analyzeEmotion(text) {
    const emotions = {
        '开心': ['开心', '高兴', '快乐', '兴奋', '满足', '幸福', '喜悦', '欣喜'],
        '难过': ['难过', '伤心', '悲伤', '痛苦', '失落', '沮丧', '忧郁', '哀伤'],
        '生气': ['生气', '愤怒', '恼火', '烦躁', '不满', '恼怒', '气愤', '暴怒'],
        '焦虑': ['焦虑', '担心', '紧张', '不安', '忧虑', '恐惧', '害怕', '慌张'],
        '平静': ['平静', '平和', '安宁', '放松', '舒适', '安心', '镇定', '淡定']
    };
    
    let detectedEmotion = '平静'; // 默认情绪
    let maxCount = 0;
    
    for (const [emotion, keywords] of Object.entries(emotions)) {
        let count = 0;
        for (const keyword of keywords) {
            const regex = new RegExp(keyword, 'gi');
            const matches = text.match(regex);
            if (matches) {
                count += matches.length;
            }
        }
        
        if (count > maxCount) {
            maxCount = count;
            detectedEmotion = emotion;
        }
    }
    
    return detectedEmotion;
}

// 处理静态文件请求
function serveStaticFile(req, res) {
    const parsedUrl = url.parse(req.url);
    let pathname = path.join(__dirname, 'public', parsedUrl.pathname);
    
    // 默认提供index.html
    if (pathname.endsWith('/')) {
        pathname = path.join(pathname, 'index.html');
    }
    
    const ext = path.extname(pathname);
    
    fs.readFile(pathname, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                // 文件不存在
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                // 服务器错误
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
            return;
        }
        
        // 文件存在，设置正确的MIME类型
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 处理API请求
async function handleApiRequest(req, res, pathname) {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // 处理OPTIONS请求（预检请求）
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // 处理GET请求 - 主要用于EventSource
    if (req.method === 'GET' && pathname === '/api/chat') {
        const parsedUrl = url.parse(req.url, true);
        const query = parsedUrl.query;
        
        req.message = query.message;
        req.emotion = query.emotion;
        await handleChatRequest(req, res);
        return;
    }
    
    // 处理POST请求
    if (req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                
                switch (pathname) {
                    case '/api/chat':
                        req.message = data.message;
                        req.emotion = data.emotion;
                        await handleChatRequest(req, res);
                        break;
                        
                    case '/api/history':
                        req.search = data.search;
                        req.emotion = data.emotion;
                        handleHistoryRequest(req, res);
                        break;
                        
                    case '/api/analyze':
                        handleAnalyzeRequest(req, res);
                        break;
                        
                    case '/api/delete':
                        handleDeleteRequest(data, res);
                        break;
                        
                    default:
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '未找到API端点' }));
                }
            } catch (error) {
                console.error('处理请求时出错:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '服务器内部错误' }));
            }
        });
    } else {
        // 非GET/POST请求
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '方法不允许' }));
    }
}

// 处理聊天请求
async function handleChatRequest(req, res) {
    try {
        // 验证输入
        if (!req.message || req.message.trim() === '') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '消息不能为空' }));
            return;
        }
        
        const userMessage = req.message.trim();
        const userEmotion = req.emotion || analyzeEmotion(userMessage);
        
        // 读取历史对话
        let chatHistory = [];
        try {
            const historyData = fs.readFileSync(HISTORY_FILE, 'utf8');
            chatHistory = JSON.parse(historyData);
        } catch (error) {
            console.error('读取历史记录时出错:', error);
            // 如果出错，使用空数组继续
        }
        
        // 准备API请求
        const messages = [
            { role: 'system', content: SYSTEM_MESSAGE },
            // 添加最近的历史消息（最多10条）
            ...chatHistory.slice(-10).flatMap(item => [
                { role: 'user', content: item.user },
                { role: 'assistant', content: item.assistant }
            ]),
            // 添加当前用户消息
            { role: 'user', content: `[情绪:${userEmotion}] ${userMessage}` }
        ];
        
        // 设置响应头，支持流式输出
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        
        // 调用DeepSeek API（流式输出）
        const response = await fetch(config.api.baseURL, {
            method: 'POST',
            headers: config.api.headers,
            body: JSON.stringify({
                model: config.api.model,
                messages: messages,
                temperature: config.api.temperature,
                stream: true // 启用流式输出
            }),
            timeout: config.api.timeout
        });
        
        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
        }
        
        // 处理流式响应 - 使用更兼容的方式处理流
        let aiResponse = "";
        
        // 发送初始事件
        res.write(`data: ${JSON.stringify({type: 'start', timestamp: new Date().toISOString(), emotion: userEmotion})}\n\n`);
        
        // 使用response.body作为流
        response.body.on('data', (chunk) => {
            const text = chunk.toString();
            const lines = text.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                            const content = data.choices[0].delta.content;
                            aiResponse += content;
                            
                            // 发送内容片段到客户端
                            res.write(`data: ${JSON.stringify({type: 'chunk', content})}\n\n`);
                        }
                    } catch (e) {
                        console.error('解析流数据时出错:', e);
                    }
                } else if (line === 'data: [DONE]') {
                    // 流结束
                    // 不做任何操作，等待流结束事件处理
                }
            }
        });
        
        // 监听流结束事件
        response.body.on('end', () => {
            // 保存对话历史
            const timestamp = new Date().toISOString();
            chatHistory.push({
                timestamp,
                user: userMessage,
                assistant: aiResponse,
                emotion: userEmotion
            });
            
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
            
            // 发送完成事件
            res.write(`data: ${JSON.stringify({type: 'end', message: aiResponse, timestamp, emotion: userEmotion})}\n\n`);
            res.end();
        });
        
    } catch (error) {
        console.error('处理聊天请求时出错:', error);
        // 如果已经设置了响应头，发送错误事件
        if (res.headersSent) {
            res.write(`data: ${JSON.stringify({type: 'error', error: '处理聊天请求时出错'})}\n\n`);
            res.end();
        } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '处理聊天请求时出错' }));
        }
    }
}

// 处理历史记录请求
function handleHistoryRequest(req, res) {
    try {
        // 读取历史对话
        const historyData = fs.readFileSync(HISTORY_FILE, 'utf8');
        const chatHistory = JSON.parse(historyData);
        
        // 根据请求参数处理历史记录
        let result = chatHistory;
        
        // 如果请求包含搜索关键词
        if (req.search && req.search.trim() !== '') {
            const keyword = req.search.trim().toLowerCase();
            result = chatHistory.filter(item => 
                item.user.toLowerCase().includes(keyword) || 
                item.assistant.toLowerCase().includes(keyword)
            );
        }
        
        // 如果请求包含情绪过滤
        if (req.emotion && req.emotion !== '全部') {
            result = result.filter(item => item.emotion === req.emotion);
        }
        
        // 返回响应
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        
    } catch (error) {
        console.error('处理历史记录请求时出错:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '处理历史记录请求时出错' }));
    }
}

// 处理情绪分析请求
function handleAnalyzeRequest(req, res) {
    try {
        // 读取历史对话
        const historyData = fs.readFileSync(HISTORY_FILE, 'utf8');
        const chatHistory = JSON.parse(historyData);
        
        // 情绪统计
        const emotionCounts = {
            '开心': 0,
            '难过': 0,
            '生气': 0,
            '焦虑': 0,
            '平静': 0
        };
        
        // 计算每种情绪的数量
        chatHistory.forEach(item => {
            if (item.emotion && emotionCounts.hasOwnProperty(item.emotion)) {
                emotionCounts[item.emotion]++;
            }
        });
        
        // 计算情绪趋势（最近10条消息）
        const recentEmotions = chatHistory.slice(-10).map(item => ({
            timestamp: item.timestamp,
            emotion: item.emotion
        }));
        
        // 返回分析结果
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            emotionCounts,
            recentEmotions,
            totalMessages: chatHistory.length
        }));
        
    } catch (error) {
        console.error('处理情绪分析请求时出错:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '处理情绪分析请求时出错' }));
    }
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname;
    
    // API路由处理
    if (pathname.startsWith('/api/')) {
        handleApiRequest(req, res, pathname);
    } else {
        // 静态文件处理
        serveStaticFile(req, res);
    }
});

// 启动服务器
const PORT = process.env.PORT || 3001; // 修改为3001端口以匹配前端API请求
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
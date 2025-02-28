const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 解析URL
    const parsedUrl = url.parse(req.url, true);
    
    // 根据路径处理不同的请求
    if (parsedUrl.pathname === '/api/chat') {
        handleChatRequest(req, res);
    } else if (parsedUrl.pathname === '/api/history') {
        handleHistoryRequest(req, res);
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

// 处理聊天请求
async function handleChatRequest(req, res) {
    try {
        // 读取请求体数据
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                
                // 处理聊天逻辑
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success',
                    message: '聊天请求已处理',
                    data: data
                }));
            } catch (error) {
                console.error('处理聊天请求时出错:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '处理聊天请求时出错' }));
            }
        });
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
}

// 处理历史记录请求
async function handleHistoryRequest(req, res) {
    try {
        // 读取请求体数据
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                
                // 处理历史记录逻辑
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    status: 'success',
                    message: '历史记录请求已处理',
                    data: data
                }));
            } catch (error) {
                console.error('处理历史记录请求时出错:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '处理历史记录请求时出错' }));
            }
        });
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
}

const PORT = process.env.PORT || 3001; // 改用3001端口
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
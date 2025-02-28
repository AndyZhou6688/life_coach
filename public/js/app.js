// 全局变量
let selectedEmotion = '平静'; // 默认情绪
let emotionChart = null;

// DOM元素
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const emotionBtns = document.querySelectorAll('.emotion-btn');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorToast = document.getElementById('errorToast');
const errorMessage = document.getElementById('errorMessage');
const historyList = document.getElementById('historyList');
const historySearch = document.getElementById('historySearch');
const analyzeBtn = document.getElementById('analyzeBtn');
const emotionAnalysis = document.getElementById('emotionAnalysis');
const aiInsights = document.getElementById('aiInsights');
const exportBtn = document.getElementById('exportBtn');
const newChatBtn = document.getElementById('newChatBtn');

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化事件监听器
    initEventListeners();
    
    // 加载历史记录
    loadChatHistory();
    
    // 初始化情绪图表
    initEmotionChart();
    
    // 默认选中平静情绪按钮
    document.querySelector('.emotion-btn[data-emotion="平静"]').classList.add('active');
});

// 初始化情绪图表
function initEmotionChart() {
    const ctx = document.getElementById('emotionChart').getContext('2d');
    emotionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['开心', '难过', '生气', '焦虑', '平静'],
            datasets: [{
                data: [0, 0, 0, 0, 1],
                backgroundColor: [
                    '#4CAF50', // 开心
                    '#9C27B0', // 难过
                    '#F44336', // 生气
                    '#FFC107', // 焦虑
                    '#e83e8c'  // 平静
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// 显示错误提示
function showError(message) {
    errorMessage.textContent = message;
    errorToast.style.display = 'flex';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        errorToast.style.display = 'none';
    }, 3000);
}

// 显示/隐藏加载状态
function showLoading(show) {
    loadingIndicator.style.display = show ? 'flex' : 'none';
}

// 初始化事件监听器
function initEventListeners() {
    // 发送按钮点击事件
    sendBtn.addEventListener('click', sendMessage);
    
    // 输入框回车键事件
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 情绪按钮点击事件
    emotionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有按钮的active类
            emotionBtns.forEach(b => b.classList.remove('active'));
            // 添加当前按钮的active类
            btn.classList.add('active');
            // 设置选中的情绪
            selectedEmotion = btn.dataset.emotion;
        });
    });
    
    // 历史搜索输入事件
    historySearch.addEventListener('input', () => {
        const keyword = historySearch.value.trim();
        loadChatHistory(keyword);
    });
    
    // 分析按钮点击事件
    analyzeBtn.addEventListener('click', analyzeEmotions);
    
    // 导出数据按钮点击事件
    exportBtn.addEventListener('click', exportChatData);
    
    // 新对话按钮点击事件
    newChatBtn.addEventListener('click', startNewChat);
};

// 导出聊天数据
function exportChatData() {
    try {
        // 获取历史记录
        fetch('http://localhost:3001/api/history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // 创建下载内容
            const content = JSON.stringify(data, null, 2);
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            // 创建下载链接
            const a = document.createElement('a');
            a.href = url;
            a.download = `deepseek_chat_history_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            
            // 清理
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 0);
        })
        .catch(error => {
            console.error('导出数据时出错:', error);
            showError('导出数据失败，请稍后重试');
        });
    } catch (error) {
        console.error('导出数据时出错:', error);
        showError('导出数据失败，请稍后重试');
    }
}

// 开始新对话
function startNewChat() {
    // 清空聊天容器，只保留欢迎消息
    chatContainer.innerHTML = '';
    
    // 添加欢迎消息
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message ai';
    welcomeMessage.innerHTML = `
        <div class="message-content">
            <p>你好！我是DeepSeek生活教练。我在这里帮助你成长和进步。请分享你的想法、问题或困扰，我会尽力提供有建设性的建议。</p>
        </div>
        <div class="message-info">
            <span class="timestamp">刚刚</span>
        </div>
    `;
    chatContainer.appendChild(welcomeMessage);
    
    // 重置情绪选择为平静
    emotionBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.emotion === '平静') {
            btn.classList.add('active');
            selectedEmotion = '平静';
        }
    });
}

// 发送消息
async function sendMessage() {
    const message = userInput.value.trim();
    
    // 验证消息不为空
    if (!message) {
        showError('请输入消息');
        return;
    }
    
    // 显示用户消息
    appendMessage('user', message, selectedEmotion);
    
    // 清空输入框
    userInput.value = '';
    
    // 显示加载状态
    showLoading(true);
    
    try {
        // 创建一个空的AI消息容器，用于流式填充内容
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'message ai';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = '<p></p>';
        
        const messageInfo = document.createElement('div');
        messageInfo.className = 'message-info';
        
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = formatTime(new Date());
        
        messageInfo.appendChild(timestamp);
        aiMessageDiv.appendChild(messageContent);
        aiMessageDiv.appendChild(messageInfo);
        
        chatContainer.appendChild(aiMessageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        let fullResponse = '';
        
        // 使用fetch API发送POST请求
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                emotion: selectedEmotion
            })
        });
        
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        
        // 读取流数据
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        switch(data.type) {
                            case 'start':
                                // 流开始，不需要特殊处理
                                break;
                                
                            case 'chunk':
                                // 接收到内容片段，追加到消息中
                                fullResponse += data.content;
                                messageContent.querySelector('p').innerHTML = formatMessage(fullResponse);
                                chatContainer.scrollTop = chatContainer.scrollHeight;
                                break;
                                
                            case 'end':
                                // 流结束，更新历史记录
                                loadChatHistory();
                                showLoading(false);
                                break;
                                
                            case 'error':
                                // 处理错误
                                showError('接收消息时出错，请稍后重试');
                                showLoading(false);
                                break;
                        }
                    } catch (e) {
                        console.error('解析流数据时出错:', e);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error('发送消息时出错:', error);
        showError('发送消息失败，请稍后重试');
        showLoading(false);
    }
}

// 添加消息到聊天容器
function appendMessage(type, content, emotion = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `<p>${formatMessage(content)}</p>`;
    
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = formatTime(new Date());
    
    messageInfo.appendChild(timestamp);
    
    // 如果是用户消息且有情绪，添加情绪标签
    if (type === 'user' && emotion) {
        const emotionTag = document.createElement('span');
        emotionTag.className = 'emotion-tag';
        emotionTag.textContent = emotion;
        messageInfo.appendChild(emotionTag);
    }
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageInfo);
    
    chatContainer.appendChild(messageDiv);
    
    // 滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 格式化消息内容（处理换行等）
function formatMessage(text) {
    // 先去除开头的换行符
    text = text.replace(/^\n+/, '');
    // 将连续的换行符替换为单个<br>标签
    text = text.replace(/\n{2,}/g, '<br><br>');
    // 将单个换行符替换为<br>标签
    text = text.replace(/\n/g, '<br>');
    // 处理Markdown加粗语法 **文本** 转换为 <strong>文本</strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return text;
}

// 格式化时间
function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    // 如果时间差小于1分钟，显示"刚刚"
    if (diff < 60000) {
        return '刚刚';
    }
    
    // 如果时间差小于1小时，显示分钟数
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}分钟前`;
    }
    
    // 如果是今天的消息，显示小时和分钟
    if (date.toDateString() === now.toDateString()) {
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    // 其他情况显示完整日期
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 加载聊天历史
async function loadChatHistory(search = '') {
    try {
        // 显示加载状态
        historyList.innerHTML = '<div class="loading">加载中...</div>';
        
        // 发送API请求
        const response = await fetch('http://localhost:3001/api/history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ search })
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        // 解析响应数据
        const data = await response.json();
        
        // 清空历史列表
        historyList.innerHTML = '';
        
        // 如果没有历史记录
        if (data.length === 0) {
            historyList.innerHTML = '<div class="no-history">暂无对话历史</div>';
            return;
        }
        
        // 按日期分组
        const groupedHistory = groupHistoryByDate(data);
        
        // 渲染历史记录
        for (const [date, items] of Object.entries(groupedHistory)) {
            // 添加日期分组
            const dateGroup = document.createElement('div');
            dateGroup.className = 'history-date-group';
            dateGroup.textContent = date;
            historyList.appendChild(dateGroup);
            
            // 添加该日期下的历史记录
            items.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                
                const historyContent = document.createElement('div');
                historyContent.className = 'history-content';
                
                const historyTitle = document.createElement('div');
                historyTitle.className = 'history-title';
                historyTitle.textContent = item.user.substring(0, 30) + (item.user.length > 30 ? '...' : '');
                
                const historyPreview = document.createElement('div');
                historyPreview.className = 'history-preview';
                historyPreview.textContent = item.assistant.substring(0, 50) + (item.assistant.length > 50 ? '...' : '');
                
                historyContent.appendChild(historyTitle);
                historyContent.appendChild(historyPreview);
                
                const historyDelete = document.createElement('div');
                historyDelete.className = 'history-delete';
                historyDelete.innerHTML = '<i class="fas fa-trash"></i>';
                
                historyItem.appendChild(historyContent);
                historyItem.appendChild(historyDelete);
                
                // 点击历史记录项加载对话
                historyContent.addEventListener('click', () => {
                    loadConversation(item);
                });
                
                // 点击删除按钮删除历史记录
                historyDelete.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteHistoryItem(item);
                });
                
                historyList.appendChild(historyItem);
            });
        }
        
    } catch (error) {
        console.error('加载历史记录时出错:', error);
        historyList.innerHTML = '<div class="error">加载历史记录失败</div>';
    }
}

// 按日期分组历史记录
function groupHistoryByDate(history) {
    const grouped = {};
    
    history.forEach(item => {
        const date = new Date(item.timestamp);
        const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        
        if (!grouped[dateString]) {
            grouped[dateString] = [];
        }
        
        grouped[dateString].push(item);
    });
    
    return grouped;
}

// 加载特定对话
function loadConversation(item) {
    // 清空聊天容器，只保留欢迎消息
    chatContainer.innerHTML = '';
    
    // 添加欢迎消息
    const welcomeMessage = document.createElement('div');
    welcomeMessage.className = 'message ai';
    welcomeMessage.innerHTML = `
        <div class="message-content">
            <p>你好！我是DeepSeek生活教练。我在这里帮助你成长和进步。请分享你的想法、问题或困扰，我会尽力提供有建设性的建议。</p>
        </div>
        <div class="message-info">
            <span class="timestamp">刚刚</span>
        </div>
    `;
    chatContainer.appendChild(welcomeMessage);
    
    // 添加用户消息
    appendMessage('user', item.user, item.emotion);
    
    // 添加AI回复
    appendMessage('ai', item.assistant);
    
    // 设置情绪按钮
    emotionBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.emotion === item.emotion) {
            btn.classList.add('active');
            selectedEmotion = item.emotion;
        }
    });
}

// 删除历史记录项
async function deleteHistoryItem(item) {
    if (!confirm('确定要删除这条对话记录吗？')) {
        return;
    }
    
    try {
        // 发送删除请求到服务器
        const response = await fetch('http://localhost:3001/api/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timestamp: item.timestamp })
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        // 重新加载历史记录
        loadChatHistory();
    } catch (error) {
        console.error('删除历史记录时出错:', error);
        showError('删除历史记录失败');
    }
}

// 分析情绪
async function analyzeEmotions() {
    try {
        // 显示加载状态
        analyzeBtn.textContent = '分析中...';
        analyzeBtn.disabled = true;
        
        // 发送API请求
        const response = await fetch('http://localhost:3001/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`服务器响应错误: ${response.status}`);
        }
        
        // 解析响应数据
        const data = await response.json();
        
        // 更新情绪图表
        updateEmotionChart(data.emotionCounts);
        
        // 更新情绪分析文本
        updateEmotionAnalysis(data);
        
        // 更新AI洞察
        updateAIInsights(data);
        
    } catch (error) {
        console.error('分析情绪时出错:', error);
        showError('分析情绪失败，请稍后重试');
    } finally {
        // 恢复按钮状态
        analyzeBtn.textContent = '开始分析';
        analyzeBtn.disabled = false;
    }
}

// 更新情绪图表
function updateEmotionChart(emotionCounts) {
    // 销毁旧图表
    if (emotionChart) {
        emotionChart.destroy();
    }
    
    // 创建新图表
    const ctx = document.getElementById('emotionChart').getContext('2d');
    emotionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(emotionCounts),
            datasets: [{
                data: Object.values(emotionCounts),
                backgroundColor: [
                    '#4CAF50', // 开心
                    '#9C27B0', // 难过
                    '#F44336', // 生气
                    '#FFC107', // 焦虑
                    '#e83e8c'  // 平静
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// 更新情绪分析文本
function updateEmotionAnalysis(data) {
    const { emotionCounts, totalMessages } = data;
    
    // 找出最多的情绪
    let maxEmotion = '平静';
    let maxCount = 0;
    
    for (const [emotion, count] of Object.entries(emotionCounts)) {
        if (count > maxCount) {
            maxCount = count;
            maxEmotion = emotion;
        }
    }
    
    // 计算百分比
    const percentage = totalMessages > 0 ? Math.round((maxCount / totalMessages) * 100) : 0;
    
    // 更新分析文本
    emotionAnalysis.innerHTML = `
        <p>在总共 ${totalMessages} 条对话中，你最常表达的情绪是 <strong>${maxEmotion}</strong>，占比 ${percentage}%。</p>
        <p>情绪分布：</p>
        <ul>
            ${Object.entries(emotionCounts).map(([emotion, count]) => 
                `<li>${emotion}: ${count} 次 (${totalMessages > 0 ? Math.round((count / totalMessages) * 100) : 0}%)</li>`
            ).join('')}
        </ul>
    `;
}

// 更新AI洞察
function updateAIInsights(data) {
    const { emotionCounts, recentEmotions } = data;
    
    // 计算情绪趋势
    let trend = '稳定';
    let recentMood = '平静';
    
    if (recentEmotions.length > 0) {
        // 获取最近的情绪
        const latestEmotions = recentEmotions.slice(-3);
        const latestEmotion = latestEmotions[latestEmotions.length - 1].emotion;
        
        // 计算积极情绪和消极情绪的数量
        const positiveCount = latestEmotions.filter(item => ['开心', '平静'].includes(item.emotion)).length;
        const negativeCount = latestEmotions.filter(item => ['难过', '生气', '焦虑'].includes(item.emotion)).length;
        
        if (positiveCount > negativeCount) {
            trend = '积极';
        } else if (negativeCount > positiveCount) {
            trend = '消极';
        }
        
        recentMood = latestEmotion;
    }
    
    // 根据情绪趋势生成洞察
    let insight = '';
    
    switch (trend) {
        case '积极':
            insight = '你最近的情绪状态趋于积极，继续保持这种状态对你的成长和进步很有帮助。';
            break;
        case '消极':
            insight = '你最近的情绪状态趋于消极，建议尝试一些放松活动，或者与朋友交流，寻求支持。';
            break;
        default:
            insight = '你的情绪状态相对稳定，这是一个良好的基础，可以帮助你更好地应对生活中的挑战。';
    }
    
    // 更新洞察文本
    aiInsights.innerHTML = `
        <p>最近情绪: <strong>${recentMood}</strong></p>
        <p>情绪趋势: <strong>${trend}</strong></p>
        <p>${insight}</p>
        <p>建议: ${getAdviceByEmotion(recentMood)}</p>
    `;
}

// 根据情绪获取建议
function getAdviceByEmotion(emotion) {
    switch (emotion) {
        case '开心':
            return '利用这种积极的情绪，尝试新的挑战或完成一些你一直想做的事情。';
        case '难过':
            return '允许自己感受这种情绪，但不要沉浸其中。尝试做一些让你感到舒适的事情，如听音乐或散步。';
        case '生气':
            return '深呼吸，给自己一些时间冷静下来。尝试理性地分析引起愤怒的原因，寻找建设性的解决方案。';
        case '焦虑':
            return '尝试一些放松技巧，如深呼吸、冥想或轻度运动。关注当下，而不是担忧未来。';
        case '平静':
            return '这是一个反思和规划的好时机。思考你的目标和价值观，制定实现它们的计划。';
        default:
            return '关注自己的情绪变化，尝试理解它们背后的原因，这有助于你更好地认识自己。';
    }
}
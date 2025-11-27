/**
 * open-nof1.ai - AI 加密货币自动交易系统
 * Copyright (C) 2025 195440
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// AI Trading Monitor - 使用真实 API

// API 配置：支持本地和远程访问
// 本地开发：留空或设为 ''，使用相对路径
// 远程访问：设为你的 Cloudflare Tunnel 地址，例如 'https://xxxxx.trycloudflare.com'
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '' // 本地访问，使用相对路径
    : 'https://api.aizidonghua.top'; // 远程访问，使用固定域名

class TradingMonitor {
    constructor() {
        this.cryptoPrices = new Map();
        this.accountData = null;
        this.equityChart = null;
        this.klineChart = null;
        this.klineCandlestickSeries = null;
        this.klineVolumeSeries = null;
        this.klineEma20Series = null;
        this.klineEma50Series = null;
        this.klineIndicatorChart = null;
        this.klineIndicatorSeries = null;
        this.klineSymbol = null;
        this.klineInterval = '1m';
        this.klineActiveIndicator = 'rsi7';
        this.chartTimeframe = '24'; // 固定24小时
        this.password = null; // 存储验证后的密码
        this.isLoggedIn = false; // 登录状态
        this.init();
    }

    async init() {
        // 初始化K线缓存
        if (window.klineCache) {
            try {
                await window.klineCache.init();
            } catch (error) {
                console.warn('K线缓存初始化失败，将直接使用API', error);
            }
        }
        
        await this.loadInitialData();
        this.initEquityChart();
        this.initKlinePanel();
        this.initTimeframeSelector();
        this.startDataUpdates();
        this.initTabs();
        this.initChat();
        this.duplicateTicker();
        this.loadGitHubStars(); // 加载 GitHub 星标数
        this.initLoginModal(); // 初始化登录弹窗
        this.checkLoginStatus(); // 检查登录状态
    }

    // 加载初始数据
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadAccountData(),
                this.loadPositionsData(),
                this.loadTradesData(),
                this.loadLogsData(),
                this.loadTickerPrices(),
                this.loadStrategyData()
            ]);
        } catch (error) {
            console.error('加载初始数据失败:', error);
        }
    }

    // 加载 GitHub 星标数
    async loadGitHubStars() {
        try {
            const response = await fetch('https://api.github.com/repos/195440/open-nof1.ai');
            const data = await response.json();
            const starsCount = document.getElementById('stars-count');
            if (starsCount && data.stargazers_count !== undefined) {
                // 格式化星标数（超过1000显示 k）
                const count = data.stargazers_count;
                starsCount.textContent = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count;
            }
        } catch (error) {
            console.error('加载 GitHub 星标数失败:', error);
            const starsCount = document.getElementById('stars-count');
            if (starsCount) {
                starsCount.textContent = '-';
            }
        }
    }

    // 加载账户数据
    async loadAccountData() {
        try {
            const response = await fetch(`${API_BASE}/api/account`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            this.accountData = data;
            
            // 使用和 app.js 相同的算法计算总资产
            // API 返回的 totalBalance 不包含未实现盈亏
            // 显示的总资产需要加上未实现盈亏，以便实时反映持仓盈亏
            const totalBalanceWithPnl = data.totalBalance + data.unrealisedPnl;
            
            // 更新总资产
        const accountValueEl = document.getElementById('account-value');
            if (accountValueEl) {
                accountValueEl.textContent = totalBalanceWithPnl.toFixed(2);
            }

            // 更新可用余额
            const availableBalanceEl = document.getElementById('available-balance');
            if (availableBalanceEl) {
                availableBalanceEl.textContent = data.availableBalance.toFixed(2);
            }

            // 更新未实现盈亏（带符号和颜色）
            const unrealisedPnlEl = document.getElementById('unrealised-pnl');
            if (unrealisedPnlEl) {
                const pnlValue = (data.unrealisedPnl >= 0 ? '+' : '') + data.unrealisedPnl.toFixed(2);
                unrealisedPnlEl.textContent = pnlValue;
                unrealisedPnlEl.className = 'detail-value ' + (data.unrealisedPnl >= 0 ? 'positive' : 'negative');
            }

            // 更新收益（总资产 - 初始资金）
        const valueChangeEl = document.getElementById('value-change');
        const valuePercentEl = document.getElementById('value-percent');

            if (valueChangeEl && valuePercentEl) {
                // 收益率 = (总资产(含未实现盈亏) - 初始资金) / 初始资金 * 100
                const totalPnl = totalBalanceWithPnl - data.initialBalance;
                const returnPercent = (totalPnl / data.initialBalance) * 100;
                const isPositive = totalPnl >= 0;
                
                valueChangeEl.textContent = `${isPositive ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`;
                valuePercentEl.textContent = `(${isPositive ? '+' : ''}${returnPercent.toFixed(2)}%)`;
                
                // 更新颜色
                valueChangeEl.className = 'change-amount ' + (isPositive ? '' : 'negative');
                valuePercentEl.className = 'change-percent ' + (isPositive ? '' : 'negative');
            }
            
        } catch (error) {
            console.error('加载账户数据失败:', error);
        }
    }

    // 加载策略数据
    async loadStrategyData() {
        try {
            const response = await fetch(`${API_BASE}/api/strategy`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            // 更新策略名称徽章
            const strategyBadge = document.getElementById('strategy-badge');
            if (strategyBadge) {
                strategyBadge.textContent = data.strategyName;
                // 移除所有策略类名
                strategyBadge.className = 'strategy-badge-inline';
                // 添加当前策略类名
                strategyBadge.classList.add(data.strategy);
            }

            // 更新策略详细信息（一行显示）
            const strategyInfoInline = document.getElementById('strategy-info-inline');
            if (strategyInfoInline) {
                const protectionMode = data.enableCodeLevelProtection ? '代码级' : 'AI';
                strategyInfoInline.textContent = `${data.intervalMinutes}分 | ${data.leverageRange} | ${data.positionSizeRange} | ${protectionMode}`;
            }
            
        } catch (error) {
            console.error('加载策略数据失败:', error);
        }
    }

    // 加载持仓数据
    async loadPositionsData() {
        try {
            const response = await fetch(`${API_BASE}/api/positions`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            const positionsBody = document.getElementById('positions-body');
            const positionsCardsContainer = document.getElementById('positions-cards-container');
            
            if (!data.positions || data.positions.length === 0) {
                // 更新表格
                if (positionsBody) {
                    positionsBody.innerHTML = '<tr><td colspan="9" class="empty-state">暂无持仓</td></tr>';
                }
                // 更新小卡片
                if (positionsCardsContainer) {
                    positionsCardsContainer.innerHTML = '<div class="positions-cards-empty">暂无持仓</div>';
                }
                return;
            }

            // 更新加密货币价格
            data.positions.forEach(pos => {
                this.cryptoPrices.set(pos.symbol, pos.currentPrice);
            });
            this.updateTickerPrices();

            // 更新持仓表格
            if (positionsBody) {
                positionsBody.innerHTML = data.positions.map(pos => {
                    const profitPercent = ((pos.unrealizedPnl / pos.openValue) * 100).toFixed(2);
                    const sideText = pos.side === 'long' ? '做多' : '做空';
                    const sideClass = pos.side === 'long' ? 'positive' : 'negative';
                    const leverage = pos.leverage || '-';
                    
                    // 平仓按钮 - 仅在已登录时显示
                    const closeButtonHtml = this.isLoggedIn 
                        ? `<button class="btn-close-position" onclick="monitor.closePosition('${pos.symbol}')">平仓</button>`
                        : '<span style="color: var(--text-dim); font-size: 0.75rem;">未登录</span>';
                    
                    return `
                        <tr>
                            <td>${pos.symbol}</td>
                            <td class="${sideClass}">${sideText}</td>
                            <td>${leverage}x</td>
                            <td>$${pos.entryPrice.toFixed(4)}</td>
                            <td>$${pos.openValue.toFixed(2)}</td>
                            <td>$${pos.currentPrice.toFixed(4)}</td>
                            <td class="${pos.unrealizedPnl >= 0 ? 'positive' : 'negative'}">
                                ${pos.unrealizedPnl >= 0 ? '+' : ''}$${pos.unrealizedPnl.toFixed(2)}
                            </td>
                            <td class="${pos.unrealizedPnl >= 0 ? 'positive' : 'negative'}">
                                ${pos.unrealizedPnl >= 0 ? '+' : ''}${profitPercent}%
                            </td>
                            <td class="td-actions">${closeButtonHtml}</td>
                        </tr>
                    `;
                }).join('');
            }

            // 更新持仓小卡片
            if (positionsCardsContainer) {
                positionsCardsContainer.innerHTML = data.positions.map(pos => {
                    const profitPercent = ((pos.unrealizedPnl / pos.openValue) * 100).toFixed(2);
                    const sideClass = pos.side;
                    const sideText = pos.side === 'long' ? '多' : '空';
                    const pnlClass = pos.unrealizedPnl >= 0 ? 'positive' : 'negative';
                    const leverage = pos.leverage || '-';
                    
                    return `
                        <div class="position-card ${sideClass} ${pnlClass}">
                            <span class="position-card-symbol">${pos.symbol} ${leverage}x</span>
                            <span class="position-card-pnl ${pnlClass}">
                                ${sideText} ${pos.unrealizedPnl >= 0 ? '+' : ''}$${pos.unrealizedPnl.toFixed(2)} (${pos.unrealizedPnl >= 0 ? '+' : ''}${profitPercent}%)
                            </span>
                        </div>
                    `;
                }).join('');
            }

            this.updateKlineSymbols(data.positions);
            
        } catch (error) {
            console.error('加载持仓数据失败:', error);
        }
    }

    // 加载交易记录 - 使用和 index.html 相同的布局
    async loadTradesData() {
        try {
            const response = await fetch(`${API_BASE}/api/trades?limit=100`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            const tradesBody = document.getElementById('trades-body');
            const countEl = document.getElementById('tradesCount');
            
            if (!data.trades || data.trades.length === 0) {
                if (tradesBody) {
                    tradesBody.innerHTML = '<tr><td colspan="9" class="empty-state">暂无交易记录</td></tr>';
                }
                if (countEl) {
                    countEl.textContent = '';
                }
                return;
            }
            
            if (countEl) {
                countEl.textContent = `(${data.trades.length})`;
            }
            
            if (tradesBody) {
                tradesBody.innerHTML = data.trades.map(trade => {
                    const date = new Date(trade.timestamp);
                    const timeStr = date.toLocaleString('zh-CN', {
                        timeZone: 'Asia/Shanghai',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    
                    // 类型显示
                    const typeText = trade.type === 'open' ? '开仓' : '平仓';
                    const typeClass = trade.type === 'open' ? 'buy' : 'sell';
                    
                    // 方向显示
                    const sideText = trade.side === 'long' ? '做多' : '做空';
                    const sideClass = trade.side === 'long' ? 'long' : 'short';
                    
                    // 盈亏显示（仅平仓时显示）
                    const pnlHtml = trade.type === 'close' && trade.pnl !== null && trade.pnl !== undefined
                        ? `<span class="${trade.pnl >= 0 ? 'profit' : 'loss'}">${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}</span>`
                        : '<span class="na">-</span>';
                    
                    return `
                        <tr>
                            <td>${timeStr}</td>
                            <td><span class="symbol">${trade.symbol}</span></td>
                            <td><span class="type ${typeClass}">${typeText}</span></td>
                            <td><span class="side ${sideClass}">${sideText}</span></td>
                            <td>${trade.price.toFixed(2)}</td>
                            <td>${trade.quantity}</td>
                            <td>${trade.leverage}x</td>
                            <td>${trade.fee.toFixed(4)}</td>
                            <td>${pnlHtml}</td>
                        </tr>
                    `;
                }).join('');
            }
            
        } catch (error) {
            console.error('加载交易记录失败:', error);
        }
    }

    // 加载 AI 决策日志 - 显示最新一条完整内容
    async loadLogsData() {
        try {
            const response = await fetch(`${API_BASE}/api/logs?limit=1`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return;
            }

            const decisionContent = document.getElementById('decision-content');
            const decisionMeta = document.getElementById('decision-meta');
            
            if (data.logs && data.logs.length > 0) {
                const log = data.logs[0]; // 只取最新一条
                
                // 更新决策元信息
                if (decisionMeta) {
                    const timestamp = new Date(log.timestamp).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    });
                    
                    decisionMeta.innerHTML = `
                        <span class="decision-time">${timestamp}</span>
                        <span class="decision-iteration">#${log.iteration}</span>
                    `;
                }
                
                // 更新决策详细内容
                if (decisionContent) {
                    const decision = log.decision || log.actionsTaken || '暂无决策内容';
                    // 使用 marked 库将 markdown 转换为 HTML
                    const htmlContent = marked.parse(decision);
                    
                    decisionContent.innerHTML = `<div class="decision-text markdown-content">${htmlContent}</div>`;
                }
            } else {
                if (decisionContent) {
                    decisionContent.innerHTML = '<p class="no-data">暂无 AI 决策记录</p>';
                }
                if (decisionMeta) {
                    decisionMeta.innerHTML = '<span class="decision-time">无数据</span>';
                }
            }
            
        } catch (error) {
            console.error('加载日志失败:', error);
            const decisionContent = document.getElementById('decision-content');
            if (decisionContent) {
                decisionContent.innerHTML = `<p class="error">加载失败: ${error.message}</p>`;
            }
        }
    }

    // 加载顶部 Ticker 价格（从 API 获取）
    async loadTickerPrices() {
        try {
            const response = await fetch(`${API_BASE}/api/prices?symbols=BTC,ETH,SOL,BNB,DOGE,XRP`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('获取价格失败:', data.error);
                return;
            }
            
            // 更新价格缓存
            Object.entries(data.prices).forEach(([symbol, price]) => {
                this.cryptoPrices.set(symbol, price);
            });
            
            // 更新显示
            this.updateTickerPrices();
        } catch (error) {
            console.error('加载 Ticker 价格失败:', error);
        }
    }

    // 更新价格滚动条
    updateTickerPrices() {
        this.cryptoPrices.forEach((price, symbol) => {
                const priceElements = document.querySelectorAll(`[data-symbol="${symbol}"]`);
                priceElements.forEach(el => {
                const decimals = price < 1 ? 4 : 2;
                el.textContent = '$' + price.toFixed(decimals);
            });
        });
    }

    // 启动数据更新
    startDataUpdates() {
        // 每3秒更新账户和持仓（实时数据）
        setInterval(async () => {
            await Promise.all([
                this.loadAccountData(),
                this.loadPositionsData()
            ]);
        }, 3000);

        // 每10秒更新价格（实时价格）
        setInterval(async () => {
            await this.loadTickerPrices();
        }, 10000);

        // 每30秒更新交易记录和日志
        setInterval(async () => {
            await Promise.all([
                this.loadTradesData(),
                this.loadLogsData()
            ]);
        }, 30000);

        // 每30秒更新资产曲线图表
        setInterval(async () => {
            await this.updateEquityChart();
        }, 30000);

        setInterval(async () => {
            if (this.klineSymbol) {
                await this.updateKlineChart();
            }
        }, 60000);
    }

    // 复制ticker内容实现无缝滚动
    duplicateTicker() {
        const ticker = document.getElementById('ticker');
        if (ticker) {
            const tickerContent = ticker.innerHTML;
            ticker.innerHTML = tickerContent + tickerContent + tickerContent;
        }
    }

    // 初始化选项卡（简化版，只有一个选项卡）
    initTabs() {
        // 已经只有一个选项卡，不需要切换功能
    }

    // 初始化聊天功能（已移除）
    initChat() {
        // 聊天功能已移除
    }

    // 初始化资产曲线图表
    async initEquityChart() {
        const ctx = document.getElementById('equityChart');
        if (!ctx) {
            console.error('未找到图表canvas元素');
            return;
        }

        // 加载历史数据
        const historyData = await this.loadEquityHistory();
        
        console.log('资产历史数据:', historyData);
        
        if (!historyData || historyData.length === 0) {
            console.log('暂无历史数据，图表将在有数据后显示');
            // 显示提示信息
            const container = ctx.parentElement;
            if (container) {
                const message = document.createElement('div');
                message.className = 'no-data';
                message.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #00cc88; text-align: center;';
                message.innerHTML = '暂无历史数据<br><small style="color: #008866;">系统将每10分钟自动记录账户资产</small>';
                container.appendChild(message);
            }
            return;
        }

        // 创建图表
        this.equityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: historyData.map(d => {
                    const date = new Date(d.timestamp);
                    return date.toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }),
                datasets: [
                    {
                        label: '总资产 (USDT)',
                        data: historyData.map(d => parseFloat(d.totalValue.toFixed(2))),
                        borderColor: 'rgb(0, 255, 170)',
                        backgroundColor: 'rgba(0, 255, 170, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#fff',
                            usePointStyle: true,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += '$' + context.parsed.y;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#9ca3af',
                            maxRotation: 45,
                            minRotation: 0,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        display: true,
                        position: 'left',
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#9ca3af',
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    // 加载资产历史数据
    async loadEquityHistory() {
        try {
            // 获取全部历史数据（通过后端 API 域名）
            const response = await fetch(`${API_BASE}/api/history`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('API错误:', data.error);
                return [];
            }
            
            return data.history || [];
        } catch (error) {
            console.error('加载资产历史数据失败:', error);
            return [];
        }
    }

    // 更新资产曲线图表
    async updateEquityChart() {
        if (!this.equityChart) {
            await this.initEquityChart();
            return;
        }

        const historyData = await this.loadEquityHistory();
        
        if (!historyData || historyData.length === 0) {
            return;
        }

        // 更新图表数据
        this.equityChart.data.labels = historyData.map(d => {
            const date = new Date(d.timestamp);
            return date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        });
        
        this.equityChart.data.datasets[0].data = historyData.map(d => 
            parseFloat(d.totalValue.toFixed(2))
        );
        
        // 固定不显示圆点
        this.equityChart.data.datasets[0].pointRadius = 0;
        
        this.equityChart.update('none'); // 无动画更新
    }

    async loadKlineData(symbol, interval) {
        if (!symbol) {
            return null;
        }
        
        const cache = window.klineCache;
        
        // 1. 先尝试从缓存读取
        if (cache && cache.db) {
            try {
                const cached = await cache.get(symbol, interval);
                
                // 如果缓存有效（不到1分钟），直接返回
                if (cached && !cache.needsUpdate(cached)) {
                    console.log(`⚡ 使用K线缓存: ${symbol} ${interval}`);
                    return cached;
                }
                
                // 如果缓存过期，先显示缓存，然后后台更新
                if (cached) {
                    console.log(`🔄 缓存已过期，后台更新: ${symbol} ${interval}`);
                    // 异步更新，不等待
                    this.updateKlineInBackground(symbol, interval, cached);
                    return cached; // 先返回旧数据
                }
            } catch (error) {
                console.warn('读取K线缓存失败:', error);
            }
        }
        
        // 2. 缓存不可用或无缓存，从API获取
        return this.fetchKlineFromAPI(symbol, interval);
    }
    
    async fetchKlineFromAPI(symbol, interval) {
        try {
            const params = new URLSearchParams();
            params.set('symbol', symbol);
            if (interval) {
                params.set('interval', interval);
            }
            const response = await fetch(`${API_BASE}/api/kline?${params.toString()}`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.error) {
                console.error('K线API错误:', data.error);
                if (this.showToast) {
                    this.showToast('K线加载失败', data.error, 'error');
                }
                return null;
            }
            
            // 保存到缓存
            if (window.klineCache && window.klineCache.db) {
                await window.klineCache.save(symbol, interval, data);
            }
            
            return data;
        } catch (error) {
            console.error('加载K线数据失败:', error);
            if (this.showToast) {
                this.showToast('K线加载失败', '网络错误或服务器异常', 'error');
            }
            return null;
        }
    }
    
    async updateKlineInBackground(symbol, interval, cachedData) {
        try {
            const newData = await this.fetchKlineFromAPI(symbol, interval);
            if (newData && newData.candles && newData.candles.length > 0) {
                // 如果当前还在显示这个K线，刷新它
                if (this.klineSymbol === symbol && this.klineInterval === interval) {
                    console.log('🔄 后台更新完成，刷新K线图');
                    this.currentKlineData = newData;
                    this.updateKlineChart();
                }
            }
        } catch (error) {
            console.warn('后台更新K线失败:', error);
        }
    }

    initKlinePanel() {
        const symbolSelect = document.getElementById('kline-symbol-select');
        const intervalSelect = document.getElementById('kline-interval-select');
        const container = document.getElementById('positionKlineChart');
        if (!symbolSelect || !intervalSelect || !container) {
            console.log('K线面板初始化失败:', { symbolSelect: !!symbolSelect, intervalSelect: !!intervalSelect, container: !!container });
            return;
        }
        console.log('K线面板初始化成功');

        if (!this.klineInterval) {
            this.klineInterval = intervalSelect.value || '1m';
        }

        // 初始化指标切换按钮
        const indicatorBtns = document.querySelectorAll('.kline-indicator-btn');
        indicatorBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                indicatorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.klineActiveIndicator = btn.dataset.indicator;
                this.updateKlineIndicator();
            });
        });
        
        // 初始化导出/导入按钮
        const exportBtn = document.getElementById('kline-export-btn');
        const importBtn = document.getElementById('kline-import-btn');
        const importFile = document.getElementById('kline-import-file');
        
        if (exportBtn) {
            exportBtn.addEventListener('click', async () => {
                if (!this.klineSymbol || !this.klineInterval) {
                    this.showToast('导出失败', '请先选择要导出的币种和周期', 'warning');
                    return;
                }
                
                if (window.klineCache) {
                    const filename = await window.klineCache.exportToFile(this.klineSymbol, this.klineInterval);
                    if (filename) {
                        this.showToast('导出成功', `已保存为: ${filename}`, 'success');
                    } else {
                        this.showToast('导出失败', '暂无可导出的数据', 'error');
                    }
                }
            });
        }
        
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => {
                importFile.click();
            });
            
            importFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                
                if (window.klineCache) {
                    try {
                        const data = await window.klineCache.importFromFile(file);
                        this.showToast('导入成功', `已导入 ${data.symbol}_${data.interval} (${data.candles.length}根K线)`, 'success');
                        
                        // 如果导入的是当前显示的币种，刷新图表
                        if (data.symbol === this.klineSymbol && data.interval === this.klineInterval) {
                            this.currentKlineData = data;
                            await this.updateKlineChart();
                        }
                    } catch (error) {
                        this.showToast('导入失败', error.message, 'error');
                    }
                }
                
                // 清空文件选择
                importFile.value = '';
            });
        }

        symbolSelect.addEventListener('change', async () => {
            this.klineSymbol = symbolSelect.value || null;
            await this.updateKlineChart();
        });

        intervalSelect.addEventListener('change', async () => {
            this.klineInterval = intervalSelect.value || '5m';
            await this.updateKlineChart();
        });
    }

    updateKlineSymbols(positions) {
        const symbolSelect = document.getElementById('kline-symbol-select');
        if (!symbolSelect) {
            return;
        }

        if (!positions || positions.length === 0) {
            symbolSelect.innerHTML = '<option value="">暂无持仓</option>';
            this.klineSymbol = null;
            if (this.klineChart) {
                const container = document.getElementById('positionKlineChart');
                if (container) {
                    container.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 2rem;">暂无持仓</div>';
                }
            }
            return;
        }

        const uniqueSymbols = Array.from(new Set(positions.map(pos => pos.symbol)));
        const previous = this.klineSymbol || symbolSelect.value;

        symbolSelect.innerHTML = uniqueSymbols.map(symbol => `<option value="${symbol}">${symbol}</option>`).join('');

        let needsUpdate = false;
        if (previous && uniqueSymbols.includes(previous)) {
            symbolSelect.value = previous;
            this.klineSymbol = previous;
        } else {
            symbolSelect.value = uniqueSymbols[0];
            this.klineSymbol = uniqueSymbols[0];
            needsUpdate = true;
        }

        if (needsUpdate || !this.klineChart) {
            this.updateKlineChart();
        }
    }

    async updateKlineChart() {
        const container = document.getElementById('positionKlineChart');
        if (!container || !this.klineSymbol) {
            return;
        }

        const interval = this.klineInterval || '1m';
        const data = await this.loadKlineData(this.klineSymbol, interval);

        if (!data || !data.candles || data.candles.length === 0) {
            container.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 2rem;">暂无K线数据</div>';
            this.klineChart = null;
            this.klineIndicatorChart = null;
            return;
        }

        // 只在首次创建容器
        let mainChartDiv = document.getElementById('kline-main-chart');
        let indicatorChartDiv = document.getElementById('kline-indicator-chart');
        
        if (!mainChartDiv || !indicatorChartDiv) {
            container.innerHTML = '';
            
            mainChartDiv = document.createElement('div');
            mainChartDiv.id = 'kline-main-chart';
            mainChartDiv.style.width = '100%';
            mainChartDiv.style.height = '380px';
            container.appendChild(mainChartDiv);

            indicatorChartDiv = document.createElement('div');
            indicatorChartDiv.id = 'kline-indicator-chart';
            indicatorChartDiv.style.width = '100%';
            indicatorChartDiv.style.height = '140px';
            indicatorChartDiv.style.marginTop = '5px';
            container.appendChild(indicatorChartDiv);
        }

        if (!this.klineChart) {
            this.klineChart = LightweightCharts.createChart(mainChartDiv, {
                width: mainChartDiv.clientWidth,
                height: 380,
                layout: {
                    background: { color: '#0a0e1a' },
                    textColor: '#9ca3af',
                },
                grid: {
                    vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                },
                rightPriceScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                },
                timeScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    timeVisible: true,
                    secondsVisible: false,
                },
            });

            this.klineCandlestickSeries = this.klineChart.addCandlestickSeries({
                upColor: '#ef4444',
                downColor: '#22c55e',
                borderDownColor: '#22c55e',
                borderUpColor: '#ef4444',
                wickDownColor: '#22c55e',
                wickUpColor: '#ef4444',
            });

            // 成交量柱状图已禁用
            // this.klineVolumeSeries = this.klineChart.addHistogramSeries({
            //     color: '#26a69a',
            //     priceFormat: {
            //         type: 'volume',
            //     },
            //     priceScaleId: 'volume',
            //     scaleMargins: {
            //         top: 0.8,
            //         bottom: 0,
            //     },
            // });

            // 创建指标副图
            this.klineIndicatorChart = LightweightCharts.createChart(indicatorChartDiv, {
                width: indicatorChartDiv.clientWidth,
                height: 140,
                layout: {
                    background: { color: '#0a0e1a' },
                    textColor: '#9ca3af',
                },
                grid: {
                    vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
                },
                rightPriceScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                },
                timeScale: {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    visible: false,
                },
            });

            // 同步时间轴
            this.klineChart.timeScale().subscribeVisibleTimeRangeChange(() => {
                const range = this.klineChart.timeScale().getVisibleRange();
                if (range && this.klineIndicatorChart) {
                    this.klineIndicatorChart.timeScale().setVisibleRange(range);
                }
            });

            window.addEventListener('resize', () => {
                if (this.klineChart && mainChartDiv) {
                    this.klineChart.applyOptions({ width: mainChartDiv.clientWidth });
                }
                if (this.klineIndicatorChart && indicatorChartDiv) {
                    this.klineIndicatorChart.applyOptions({ width: indicatorChartDiv.clientWidth });
                }
            });
        }

        // 转换时间戳为秒级，并转换为本地时区（东八区+8小时）
        const tzOffset = 8 * 3600; // UTC+8
        const candleData = data.candles.map(c => ({
            time: Math.floor(c.timestamp / 1000) + tzOffset,
            open: parseFloat(c.open),
            high: parseFloat(c.high),
            low: parseFloat(c.low),
            close: parseFloat(c.close),
        }));

        // 成交量数据已禁用
        // const volumeData = data.candles.map(c => ({
        //     time: Math.floor(c.timestamp / 1000) + tzOffset,
        //     value: parseFloat(c.volume),
        //     color: c.close >= c.open ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)',
        // }));

        this.klineCandlestickSeries.setData(candleData);
        // this.klineVolumeSeries.setData(volumeData);

        if (data.indicators && data.indicators.ema20 && data.indicators.ema20.length > 0) {
            if (!this.klineEma20Series) {
                this.klineEma20Series = this.klineChart.addLineSeries({
                    color: '#3b82f6',
                    lineWidth: 2,
                    title: 'EMA20',
                });
            }
            // 确保数据长度一致
            const ema20Data = data.indicators.ema20
                .map((value, index) => {
                    if (!data.candles[index] || !value) return null;
                    return {
                        time: Math.floor(data.candles[index].timestamp / 1000) + tzOffset,
                        value: parseFloat(value),
                    };
                })
                .filter(d => d !== null);
            this.klineEma20Series.setData(ema20Data);
        }

        if (data.indicators && data.indicators.ema50 && data.indicators.ema50.length > 0) {
            if (!this.klineEma50Series) {
                this.klineEma50Series = this.klineChart.addLineSeries({
                    color: '#f59e0b',
                    lineWidth: 2,
                    title: 'EMA50',
                });
            }
            // 确保数据长度一致
            const ema50Data = data.indicators.ema50
                .map((value, index) => {
                    if (!data.candles[index] || !value) return null;
                    return {
                        time: Math.floor(data.candles[index].timestamp / 1000) + tzOffset,
                        value: parseFloat(value),
                    };
                })
                .filter(d => d !== null);
            this.klineEma50Series.setData(ema50Data);
        }

        this.klineChart.timeScale().fitContent();
        
        // 存储数据供指标使用
        this.currentKlineData = data;
        this.updateKlineIndicator();
    }

    updateKlineIndicator() {
        if (!this.currentKlineData || !this.klineIndicatorChart) {
            return;
        }

        const data = this.currentKlineData;
        const indicator = this.klineActiveIndicator;

        // 清除旧的指标
        if (this.klineIndicatorSeries) {
            this.klineIndicatorChart.removeSeries(this.klineIndicatorSeries);
            this.klineIndicatorSeries = null;
        }

        // 时区偏移（东八区）
        const tzOffset = 8 * 3600;
        
        // 根据选择的指标绘制
        if (indicator === 'rsi7' && data.indicators?.rsi7) {
            this.klineIndicatorSeries = this.klineIndicatorChart.addLineSeries({
                color: '#f59e0b',
                lineWidth: 2,
                title: 'RSI(7)',
            });
            const rsiData = data.indicators.rsi7
                .map((value, index) => {
                    if (!data.candles[index] || value == null) return null;
                    return {
                        time: Math.floor(data.candles[index].timestamp / 1000) + tzOffset,
                        value: parseFloat(value),
                    };
                })
                .filter(d => d !== null);
            this.klineIndicatorSeries.setData(rsiData);
        } else if (indicator === 'rsi14' && data.indicators?.rsi14) {
            this.klineIndicatorSeries = this.klineIndicatorChart.addLineSeries({
                color: '#ef4444',
                lineWidth: 2,
                title: 'RSI(14)',
            });
            const rsiData = data.indicators.rsi14
                .map((value, index) => {
                    if (!data.candles[index] || value == null) return null;
                    return {
                        time: Math.floor(data.candles[index].timestamp / 1000) + tzOffset,
                        value: parseFloat(value),
                    };
                })
                .filter(d => d !== null);
            this.klineIndicatorSeries.setData(rsiData);
        } else if (indicator === 'macd' && data.indicators?.macd) {
            // MACD柱状图
            this.klineIndicatorSeries = this.klineIndicatorChart.addHistogramSeries({
                color: '#3b82f6',
                title: 'MACD',
            });
            const macdData = data.indicators.macd
                .map((value, index) => {
                    if (!data.candles[index] || value == null) return null;
                    return {
                        time: Math.floor(data.candles[index].timestamp / 1000) + tzOffset,
                        value: parseFloat(value),
                        color: value >= 0 ? '#ef4444' : '#22c55e',
                    };
                })
                .filter(d => d !== null);
            this.klineIndicatorSeries.setData(macdData);
        } else if (indicator === 'atr' && data.indicators?.atr) {
            this.klineIndicatorSeries = this.klineIndicatorChart.addLineSeries({
                color: '#8b5cf6',
                lineWidth: 2,
                title: 'ATR',
            });
            const atrData = data.indicators.atr
                .map((value, index) => {
                    if (!data.candles[index] || value == null) return null;
                    return {
                        time: Math.floor(data.candles[index].timestamp / 1000) + tzOffset,
                        value: parseFloat(value),
                    };
                })
                .filter(d => d !== null);
            this.klineIndicatorSeries.setData(atrData);
        }

        this.klineIndicatorChart.timeScale().fitContent();
    }

    // 初始化时间范围选择器（已禁用切换功能）
    initTimeframeSelector() {
        // 时间范围已固定为24小时，不再支持切换
    }

    // 初始化涨跌颜色切换功能
    initColorSchemeToggle() {
        const toggleBtn = document.getElementById('trend-colors-btn');
        if (toggleBtn) {
            // 加载保存的颜色方案
            this.loadColorScheme();
            
            toggleBtn.addEventListener('click', () => {
                this.toggleColorScheme();
            });
        }
    }

    // 加载保存的颜色方案
    loadColorScheme() {
        const savedScheme = localStorage.getItem('colorScheme');
        const body = document.body;
        
        if (savedScheme === 'reversed') {
            // 应用红跌绿涨模式
            body.classList.add('color-mode-reversed');
            this.updateButtonText('红跌绿涨');
        } else {
            // 应用默认的红涨绿跌模式
            body.classList.remove('color-mode-reversed');
            this.updateButtonText('红涨绿跌');
        }
    }

    // 切换涨跌颜色方案
    toggleColorScheme() {
        const body = document.body;
        const isReversed = body.classList.contains('color-mode-reversed');
        
        if (isReversed) {
            // 切换到红涨绿跌模式
            body.classList.remove('color-mode-reversed');
            this.updateButtonText('红涨绿跌');
            localStorage.setItem('colorScheme', 'default');
        } else {
            // 切换到红跌绿涨模式
            body.classList.add('color-mode-reversed');
            this.updateButtonText('红跌绿涨');
            localStorage.setItem('colorScheme', 'reversed');
        }
    }

    // 更新按钮文本
    updateButtonText(text) {
        const toggleBtn = document.getElementById('trend-colors-btn');
        if (toggleBtn) {
            toggleBtn.textContent = `THEME: ${text}`;
        }
    }

    // 初始化登录弹窗
    initLoginModal() {
        const loginBtn = document.getElementById('login-btn');
        const modal = document.getElementById('login-modal');
        const modalClose = document.getElementById('modal-close');
        const btnCancel = document.getElementById('btn-cancel');
        const btnConfirm = document.getElementById('btn-confirm');
        const passwordInput = document.getElementById('password-input');

        // 登录按钮点击
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                if (this.isLoggedIn) {
                    // 已登录则退出登录
                    this.logout();
                } else {
                    // 未登录则显示登录弹窗
                    modal.classList.add('show');
                    passwordInput.value = '';
                    passwordInput.focus();
                }
            });
        }

        // 关闭弹窗
        const closeModal = () => {
            modal.classList.remove('show');
            passwordInput.value = '';
        };

        if (modalClose) {
            modalClose.addEventListener('click', closeModal);
        }

        if (btnCancel) {
            btnCancel.addEventListener('click', closeModal);
        }

        // 点击弹窗外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // 确认登录
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                const password = passwordInput.value.trim();
                if (password) {
                    this.login(password);
                    closeModal();
                } else {
                    this.showToast('输入错误', '请输入密码', 'warning');
                }
            });
        }

        // 回车登录
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    btnConfirm.click();
                }
            });
        }
    }

    // 检查登录状态
    checkLoginStatus() {
        const savedPassword = sessionStorage.getItem('close_position_password');
        if (savedPassword) {
            this.password = savedPassword;
            this.isLoggedIn = true;
            this.updateLoginButton();
        }
    }

    // 登录
    login(password) {
        this.password = password;
        this.isLoggedIn = true;
        sessionStorage.setItem('close_position_password', password);
        this.updateLoginButton();
        this.loadPositionsData(); // 重新加载持仓以显示平仓按钮
        this.showToast('登录成功', '现在可以进行平仓操作了', 'success');
        console.log('登录成功');
    }

    // 退出登录
    logout() {
        this.password = null;
        this.isLoggedIn = false;
        sessionStorage.removeItem('close_position_password');
        this.updateLoginButton();
        this.loadPositionsData(); // 重新加载持仓以隐藏平仓按钮
        this.showToast('已退出', '已退出登录状态', 'info');
        console.log('已退出登录');
    }

    // 更新登录按钮状态
    updateLoginButton() {
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            if (this.isLoggedIn) {
                loginBtn.textContent = '退出';
                loginBtn.classList.add('logged-in');
            } else {
                loginBtn.textContent = '登录';
                loginBtn.classList.remove('logged-in');
            }
        }
    }

    // 显示 Toast 通知
    showToast(title, message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // 图标映射
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">×</button>
        `;

        container.appendChild(toast);

        // 关闭按钮
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });

        // 自动移除（成功消息 3 秒，其他消息 5 秒）
        const timeout = type === 'success' ? 3000 : 5000;
        setTimeout(() => {
            this.removeToast(toast);
        }, timeout);
    }

    // 移除 Toast
    removeToast(toast) {
        toast.classList.add('toast-removing');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    // 平仓功能
    async closePosition(symbol) {
        if (!this.isLoggedIn || !this.password) {
            this.showToast('未登录', '请先登录后再进行平仓操作', 'warning');
            return;
        }

        try {
            // 禁用所有平仓按钮
            const buttons = document.querySelectorAll('.btn-close-position');
            buttons.forEach(btn => btn.disabled = true);

            console.log(`开始平仓: ${symbol}`);

            const response = await fetch(`${API_BASE}/api/close-position`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    symbol: symbol,
                    password: this.password,
                }),
            });

            const result = await response.json();

            if (result.success) {
                const pnl = result.data.pnl.toFixed(2);
                const pnlText = result.data.pnl >= 0 ? `+${pnl}` : pnl;
                this.showToast(
                    '平仓成功', 
                    `${symbol} 已平仓，盈亏: ${pnlText} USDT`, 
                    'success'
                );
                console.log('平仓成功:', result);
                
                // 刷新数据
                await Promise.all([
                    this.loadAccountData(),
                    this.loadPositionsData(),
                    this.loadTradesData(),
                ]);
            } else {
                // 如果是密码错误，自动退出登录
                if (response.status === 403) {
                    this.showToast('密码错误', '密码验证失败，已自动退出登录', 'error');
                    this.logout();
                } else {
                    this.showToast('平仓失败', result.message, 'error');
                }
                console.error('平仓失败:', result);
            }
        } catch (error) {
            console.error('平仓请求失败:', error);
            this.showToast('平仓失败', error.message, 'error');
        } finally {
            // 重新启用平仓按钮
            const buttons = document.querySelectorAll('.btn-close-position');
            buttons.forEach(btn => btn.disabled = false);
        }
    }
}

// 全局变量存储 monitor 实例，以便在 HTML onclick 中调用
let monitor;

// 初始化监控系统
document.addEventListener('DOMContentLoaded', () => {
    monitor = new TradingMonitor();
    // 初始化涨跌颜色切换功能
    monitor.initColorSchemeToggle();
});

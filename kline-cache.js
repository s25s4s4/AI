/**
 * K线数据缓存管理器 - 使用IndexedDB存储
 * 提升K线加载速度，减少网络请求
 */
class KlineCache {
    constructor() {
        this.dbName = 'KlineDB';
        this.storeName = 'candles';
        this.db = null;
        this.maxCacheAge = 60000; // 1分钟缓存过期时间
        this.maxCandles = 500; // 最多保留500根K线（约1个月的4小时K线）
    }

    /**
     * 初始化IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => {
                console.error('IndexedDB打开失败:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ K线缓存数据库已初始化');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                    console.log('📦 创建K线缓存存储');
                }
            };
        });
    }

    /**
     * 生成缓存键
     */
    getCacheKey(symbol, interval) {
        return `${symbol}_${interval}`;
    }

    /**
     * 保存K线数据到缓存
     */
    async save(symbol, interval, data) {
        if (!this.db) {
            console.warn('IndexedDB未初始化，跳过缓存');
            return;
        }

        try {
            const key = this.getCacheKey(symbol, interval);
            const tx = this.db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            
            const cacheData = {
                symbol,
                interval,
                candles: data.candles.slice(-this.maxCandles), // 只保留最新200根
                indicators: data.indicators,
                lastUpdate: Date.now()
            };
            
            store.put(cacheData, key);
            
            await new Promise((resolve, reject) => {
                tx.oncomplete = () => {
                    console.log(`💾 K线已缓存: ${key} (${cacheData.candles.length}根)`);
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.error('保存K线缓存失败:', error);
        }
    }

    /**
     * 从缓存读取K线数据
     */
    async get(symbol, interval) {
        if (!this.db) {
            return null;
        }

        try {
            const key = this.getCacheKey(symbol, interval);
            const tx = this.db.transaction([this.storeName], 'readonly');
            const store = tx.objectStore(this.storeName);
            
            return new Promise((resolve) => {
                const request = store.get(key);
                request.onsuccess = () => {
                    const data = request.result;
                    if (data) {
                        console.log(`📦 从缓存加载: ${key} (${data.candles.length}根)`);
                    }
                    resolve(data);
                };
                request.onerror = () => resolve(null);
            });
        } catch (error) {
            console.error('读取K线缓存失败:', error);
            return null;
        }
    }

    /**
     * 检查缓存是否需要更新
     */
    needsUpdate(cachedData) {
        if (!cachedData) return true;
        const age = Date.now() - cachedData.lastUpdate;
        return age > this.maxCacheAge;
    }

    /**
     * 获取缓存中最后一根K线的时间戳
     */
    getLastTimestamp(cachedData) {
        if (!cachedData || !cachedData.candles || cachedData.candles.length === 0) {
            return null;
        }
        return cachedData.candles[cachedData.candles.length - 1].timestamp;
    }

    /**
     * 合并新旧K线数据
     */
    mergeCandles(oldCandles, newCandles) {
        if (!oldCandles || oldCandles.length === 0) {
            return newCandles;
        }
        
        if (!newCandles || newCandles.length === 0) {
            return oldCandles;
        }

        // 使用Map去重（基于时间戳）
        const candleMap = new Map();
        
        // 先添加旧数据
        oldCandles.forEach(candle => {
            candleMap.set(candle.timestamp, candle);
        });
        
        // 再添加新数据（会覆盖相同时间戳的旧数据）
        newCandles.forEach(candle => {
            candleMap.set(candle.timestamp, candle);
        });
        
        // 转换为数组并排序
        const merged = Array.from(candleMap.values())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-this.maxCandles); // 只保留最新200根
        
        return merged;
    }

    /**
     * 清除所有缓存
     */
    async clear() {
        if (!this.db) return;

        try {
            const tx = this.db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.clear();
            
            await new Promise((resolve, reject) => {
                tx.oncomplete = () => {
                    console.log('🗑️ K线缓存已清空');
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.error('清空K线缓存失败:', error);
        }
    }

    /**
     * 导出K线数据到JSON文件
     */
    async exportToFile(symbol, interval) {
        const data = await this.get(symbol, interval);
        if (!data) {
            console.warn('没有可导出的数据');
            return null;
        }
        
        const filename = `kline_${symbol}_${interval}_${new Date().toISOString().split('T')[0]}.json`;
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log(`📥 已导出K线数据: ${filename}`);
        return filename;
    }
    
    /**
     * 从JSON文件导入K线数据
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (!data.symbol || !data.interval || !data.candles) {
                        throw new Error('无效的K线数据文件');
                    }
                    
                    // 保存到缓存
                    await this.save(data.symbol, data.interval, data);
                    console.log(`📤 已导入K线数据: ${data.symbol}_${data.interval} (${data.candles.length}根)`);
                    resolve(data);
                } catch (error) {
                    console.error('导入K线数据失败:', error);
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
    
    /**
     * 导出所有缓存数据
     */
    async exportAllToFile() {
        if (!this.db) return;
        
        try {
            const tx = this.db.transaction([this.storeName], 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const allData = request.result;
                    
                    if (allData.length === 0) {
                        console.warn('没有可导出的数据');
                        resolve(null);
                        return;
                    }
                    
                    const filename = `kline_all_${new Date().toISOString().split('T')[0]}.json`;
                    const json = JSON.stringify(allData, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    
                    URL.revokeObjectURL(url);
                    console.log(`📥 已导出所有K线数据: ${filename} (${allData.length}个币种)`);
                    resolve(filename);
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('导出所有数据失败:', error);
        }
    }
    
    /**
     * 删除特定缓存
     */
    async delete(symbol, interval) {
        if (!this.db) return;

        try {
            const key = this.getCacheKey(symbol, interval);
            const tx = this.db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            store.delete(key);
            
            await new Promise((resolve, reject) => {
                tx.oncomplete = () => {
                    console.log(`🗑️ 已删除缓存: ${key}`);
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            console.error('删除K线缓存失败:', error);
        }
    }
}

// 导出单例
window.klineCache = new KlineCache();

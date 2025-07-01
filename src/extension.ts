import * as vscode from 'vscode';
import * as https from 'https';

let statusBarItem: vscode.StatusBarItem;
let intervalId: NodeJS.Timeout | undefined;
let isActive = false; 
export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("vscode-extends.status", () => {
        if (!isActive) {
            statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            statusBarItem.show();
            context.subscriptions.push(statusBarItem);

            fetchAndUpdateStatus(); // 立即执行一次
            intervalId = setInterval(fetchAndUpdateStatus, 3000); // 每 3 秒刷新一次
            isActive = true;
        } else {
            // 再次调用则关闭状态栏和定时器
            if (intervalId) clearInterval(intervalId);
            intervalId = undefined;

            if (statusBarItem) {
                
                statusBarItem.dispose();
                
            }

            isActive = false;
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    if (intervalId) clearInterval(intervalId);
    if (statusBarItem) statusBarItem.dispose();
}
async function fetchAndUpdateStatus() {
    // 你的主行情接口逻辑
    let mainText = '';
    const timestamp = Date.now();
    const url = `https://api.jijinhao.com/sQuoteCenter/realTime.htm?code=JO_92233&isCalc=true&_=${timestamp}`;

    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://quote.cngold.org/',
        }
    };

    try {
        mainText = await new Promise<string>((resolve) => {
            https.get(url, options, (res) => {
                let rawData = '';
                res.on('data', chunk => rawData += chunk);
                res.on('end', () => {
                    try {
                        const fields = rawData.split(',');
                        if (fields.length >= 36) {
                            const field4 = parseFloat(fields[3]);
                            const field5 = parseFloat(fields[4]);
                            const field6 = parseFloat(fields[5]);
                            const field35 = fields[34];
                            const field36 = fields[35];

                            const high = (field4 - field5).toFixed(2);
                            const low = (field4 - field6).toFixed(2);

                            resolve(`high:${high} low:${low} day:${field35} ${field36}`);
                        } else {
                            resolve('stop');
                        }
                    } catch {
                        resolve('api error');
                    }
                });
            }).on('error', () => {
                resolve('net error');
            });
        });
    } catch {
        mainText = 'net error';
    }

    // 调用你刚写的韩国元牌价
    let krwText = await fetchKRWExchangeRateSimple();

    // 更新到状态栏
    statusBarItem.text = `${mainText} | ${krwText}`;
}
function fetchKRWExchangeRateSimple(): Promise<string> {
    return new Promise((resolve) => {
        const url = 'https://www.boc.cn/sourcedb/whpj/';
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        };

        https.get(url, options, (res) => {
            let rawData = '';
            res.setEncoding('utf8'); // 网页是GBK，但我们不用转码，就用utf8读会乱码
            res.on('data', chunk => rawData += chunk);
            res.on('end', () => {
                try {
                    // 简单处理：去掉换行符和多余空白
                    const html = rawData.replace(/\s+/g, ' ');

                    // 粗暴找出所有 <td> 内容
                    const tdRegex = /<td[^>]*>(.*?)<\/td>/g;
                    const cells: string[] = [];
                    let match;
                    while ((match = tdRegex.exec(html)) !== null) {
                        cells.push(match[1].trim());
                    }

                    // 在所有单元格里找“韩国元”，然后取下一个单元格
                    for (let i = 0; i < cells.length - 1; i++) {
                        if (cells[i].includes('韩') && cells[i].includes('元')) {
                            const rate = cells[i + 1];
                            resolve(`KRW: ${rate}`);
                            return;
                        }
                    }

                    resolve('KRW not found');
                } catch (err) {
                    resolve('KRW parse error');
                }
            });
        }).on('error', () => {
            resolve('KRW net error');
        });
    });
}
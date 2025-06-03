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
function fetchAndUpdateStatus() {
    const timestamp = Date.now();
    const url = `https://api.jijinhao.com/sQuoteCenter/realTime.htm?code=JO_92233&isCalc=true&_=${timestamp}`;

    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': 'https://quote.cngold.org/',
        }
    };

    https.get(url, options, (res) => {
        let rawData = '';
        res.on('data', chunk => rawData += chunk);
        res.on('end', () => {
            try {
                const fields = rawData.split(',');
                if (fields.length >= 36) {
                    const field3 = parseFloat(fields[2]);
                    const field4 = parseFloat(fields[3]);
                    const field5 = parseFloat(fields[4]);
                    const field6 = parseFloat(fields[5]);
                    const field35 = fields[34];
                    const field36 = fields[35];

                    const high = (field4 - field5).toFixed(2);
                    const low = (field4 - field6).toFixed(2);

                    statusBarItem.text = `high:${high} low:${low} day:${field35} ${field36}`;
                } else {
                    statusBarItem.text = 'stop';
                }
            } catch (err) {
                statusBarItem.text = 'api error';
            }
        });
    }).on('error', (err) => {
        statusBarItem.text = 'net error';
    });
}


console.log("DEBUG MODULE LOADED");

const MAX_LOGS = 1000;
const logs = [];

// UI Elements
let consoleEl, outputEl, showBtn;

export class Logger {
    static init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', Logger.initUI);
        } else {
            Logger.initUI();
        }
        Logger.overrideConsole();
    }

    static initUI() {
        consoleEl = document.getElementById('debugConsole');
        outputEl = document.getElementById('debugOutput');
        showBtn = document.getElementById('showDebugBtn');

        if (!consoleEl) return;

        const closeBtn = document.getElementById('closeDebugBtn');
        const showDebugBtn = document.getElementById('showDebugBtn');
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        const copyLogsBtn = document.getElementById('copyLogsBtn');

        if (closeBtn) closeBtn.addEventListener('click', () => Logger.toggleConsole(false));
        if (showDebugBtn) showDebugBtn.addEventListener('click', () => Logger.toggleConsole(true));
        if (clearLogsBtn) clearLogsBtn.addEventListener('click', Logger.clearLogs);
        if (copyLogsBtn) copyLogsBtn.addEventListener('click', Logger.copyLogs);

        // Initial render
        Logger.renderLogs();
    }

    static toggleConsole(show) {
        if (show) {
            consoleEl.classList.remove('hidden');
            showBtn.classList.add('hidden');
            Logger.scrollToBottom();
        } else {
            consoleEl.classList.add('hidden');
            showBtn.classList.remove('hidden');
        }
    }

    static addLog(type, args) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Object]';
                }
            }
            return String(arg);
        }).join(' ');

        logs.push({ timestamp, type, message });
        if (logs.length > MAX_LOGS) logs.shift();

        if (outputEl) {
            const row = document.createElement('div');
            row.className = `font-mono text-xs border-b border-gray-800 pb-0.5 mb-0.5 ${Logger.getColorForType(type)}`;
            row.innerHTML = `<span class="opacity-50 mr-2">[${timestamp}]</span><span>${Logger.escapeHtml(message)}</span>`;
            outputEl.appendChild(row);
            Logger.scrollToBottom();
        }
    }

    static renderLogs() {
        if (!outputEl) return;
        outputEl.innerHTML = '';
        logs.forEach(l => {
            const row = document.createElement('div');
            row.className = `font-mono text-xs border-b border-gray-800 pb-0.5 mb-0.5 ${Logger.getColorForType(l.type)}`;
            row.innerHTML = `<span class="opacity-50 mr-2">[${l.timestamp}]</span><span>${Logger.escapeHtml(l.message)}</span>`;
            outputEl.appendChild(row);
        });
        Logger.scrollToBottom();
    }

    static getColorForType(type) {
        switch (type) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'info': return 'text-blue-400';
            default: return 'text-green-400';
        }
    }

    static escapeHtml(str) {
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    static scrollToBottom() {
        if (outputEl) outputEl.scrollTop = outputEl.scrollHeight;
    }

    static clearLogs() {
        logs.length = 0;
        if (outputEl) outputEl.innerHTML = '';
    }

    static copyLogs() {
        const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert('Logs copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy logs:', err);
        });
    }

    static overrideConsole() {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        const originalInfo = console.info;

        console.log = function (...args) {
            originalLog.apply(console, args);
            Logger.addLog('log', args);
        };

        console.warn = function (...args) {
            originalWarn.apply(console, args);
            Logger.addLog('warn', args);
        };

        console.error = function (...args) {
            // Ignore benign ResizeObserver loop errors
            if (args.length > 0) {
                const firstArg = args[0];
                if (typeof firstArg === 'string' && firstArg.includes('ResizeObserver loop')) return;
                if (firstArg instanceof Error && firstArg.message && firstArg.message.includes('ResizeObserver loop')) return;
            }
            originalError.apply(console, args);
            Logger.addLog('error', args);
        };

        console.info = function (...args) {
            originalInfo.apply(console, args);
            Logger.addLog('info', args);
        };
    }
}

// Auto-initialize (Strangler Pattern behavior: Debug needs to run automatically)
Logger.init();



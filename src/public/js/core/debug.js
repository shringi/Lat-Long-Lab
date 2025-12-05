
console.log("DEBUG.JS LOADED");

(() => {
    const MAX_LOGS = 1000;
    const logs = [];

    // UI Elements
    let consoleEl, outputEl, showBtn;

    function initDebugUI() {
        consoleEl = document.getElementById('debugConsole');
        outputEl = document.getElementById('debugOutput');
        showBtn = document.getElementById('showDebugBtn');

        if (!consoleEl) return;

        const closeBtn = document.getElementById('closeDebugBtn');
        const showDebugBtn = document.getElementById('showDebugBtn');
        const clearLogsBtn = document.getElementById('clearLogsBtn');
        const copyLogsBtn = document.getElementById('copyLogsBtn');

        if (closeBtn) closeBtn.addEventListener('click', () => toggleConsole(false));
        if (showDebugBtn) showDebugBtn.addEventListener('click', () => toggleConsole(true));
        if (clearLogsBtn) clearLogsBtn.addEventListener('click', clearLogs);
        if (copyLogsBtn) copyLogsBtn.addEventListener('click', copyLogs);

        // Initial render of any logs captured before UI init
        renderLogs();
    }

    function toggleConsole(show) {
        if (show) {
            consoleEl.classList.remove('hidden');
            showBtn.classList.add('hidden');
            scrollToBottom();
        } else {
            consoleEl.classList.add('hidden');
            showBtn.classList.remove('hidden');
        }
    }

    function addLog(type, args) {
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
            row.className = `font-mono text-xs border-b border-gray-800 pb-0.5 mb-0.5 ${getColorForType(type)}`;
            row.innerHTML = `<span class="opacity-50 mr-2">[${timestamp}]</span><span>${escapeHtml(message)}</span>`;
            outputEl.appendChild(row);
            scrollToBottom();
        }
    }

    function renderLogs() {
        if (!outputEl) return;
        outputEl.innerHTML = '';
        logs.forEach(l => {
            const row = document.createElement('div');
            row.className = `font-mono text-xs border-b border-gray-800 pb-0.5 mb-0.5 ${getColorForType(l.type)}`;
            row.innerHTML = `<span class="opacity-50 mr-2">[${l.timestamp}]</span><span>${escapeHtml(l.message)}</span>`;
            outputEl.appendChild(row);
        });
        scrollToBottom();
    }

    function getColorForType(type) {
        switch (type) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'info': return 'text-blue-400';
            default: return 'text-green-400';
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function scrollToBottom() {
        if (outputEl) outputEl.scrollTop = outputEl.scrollHeight;
    }

    function clearLogs() {
        logs.length = 0;
        if (outputEl) outputEl.innerHTML = '';
    }

    function copyLogs() {
        const text = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert('Logs copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy logs:', err);
        });
    }

    // Override Console
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = function (...args) {
        originalLog.apply(console, args);
        addLog('log', args);
    };

    console.warn = function (...args) {
        originalWarn.apply(console, args);
        addLog('warn', args);
    };

    console.error = function (...args) {
        originalError.apply(console, args);
        addLog('error', args);
    };

    console.info = function (...args) {
        originalInfo.apply(console, args);
        addLog('info', args);
    };

    // Initialize UI on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDebugUI);
    } else {
        initDebugUI();
    }
})();

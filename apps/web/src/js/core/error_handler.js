/**
 * Global Error Handler
 * Catches unhandled errors and promise rejections early in the startup phase.
 */
(function () {
    window.onerror = function (msg, url, line, col, error) {
        // Ignore benign ResizeObserver loop errors
        if (msg && msg.toString().includes('ResizeObserver')) {
            return true; // Suppress error
        }

        var extra = !col ? '' : '\ncolumn: ' + col;
        extra += !error ? '' : '\nerror: ' + error;
        console.error("Error: " + msg + "\nurl: " + url + "\nline: " + line + extra);

        var errorDiv = document.createElement("div");
        Object.assign(errorDiv.style, {
            position: "fixed", top: "0", left: "0", width: "100%",
            backgroundColor: "#ef4444", color: "white", zIndex: "999999",
            padding: "1rem", fontFamily: "monospace", fontSize: "0.875rem",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        });
        errorDiv.innerText = "CRITICAL ERROR: " + msg + " at " + line;
        document.body.appendChild(errorDiv);
        return false;
    };

    // Catch unhandled promise rejections (e.g. dynamic imports failing)
    window.addEventListener('unhandledrejection', function (event) {
        console.error('Unhandled rejection (promise):', event.reason);
    });

    console.log("Global error handler registered");
})();

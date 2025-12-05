import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
    return {
        // Root directory is strict for now (until we migrate to src/)
        root: 'src',
        // Use root path for local dev, repo name for production build (GitHub Pages)
        base: command === 'serve' ? '/' : '/Lat-Long-Lab/',
        build: {
            outDir: '../dist',
            emptyOutDir: true,
        },
        server: {
            open: true, // Opens browser automatically
            port: 3000,
        }
    };
});

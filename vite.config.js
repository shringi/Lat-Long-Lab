import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
    return {
        // Root directory is strict for now (until we migrate to src/)
        root: 'src',
        // Use relative path for maximum compatibility (works for local preview & GH Pages)
        base: './',
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

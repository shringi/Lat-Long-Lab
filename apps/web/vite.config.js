import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
        },
        plugins: [
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['icons/favicon.ico', 'icons/logo_192.png', 'icons/logo_512.png', 'icons/loading_icon.png'],
                manifest: {
                    name: 'Lat-Long Lab',
                    short_name: 'LatLongLab',
                    description: 'A super light, privacy focused web app for a quick latitude-longitude visualization and data filtering.',
                    theme_color: '#2563eb',
                    background_color: '#ffffff',
                    display: 'standalone',
                    start_url: './',
                    icons: [
                        {
                            src: 'icons/logo_192.png',
                            sizes: '192x192',
                            type: 'image/png'
                        },
                        {
                            src: 'icons/logo_512.png',
                            sizes: '512x512',
                            type: 'image/png'
                        }
                    ]
                }
            })
        ],
        test: {
            environment: 'jsdom',
            globals: true
        }
    };
});

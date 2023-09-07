import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    // Configure build options here
    target: 'modules', // or 'modules' for modern browsers
    outDir: 'build', // Change to your desired output directory
    base: '/', // Change to your desired public path
    minify: true, // Minify JavaScript
    brotliSize: true, // Enable Brotli compression for assets
    sourcemap: true, // Enable source maps
    assetsInlineLimit: 4096, // Set maximum inline asset size in bytes
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]', // Customize how assets are named
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/expenses-analyzer/',
  build: {
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              test: /node_modules\/(react|react-dom)\//,
              name: 'react',
            },
            {
              test: /node_modules\/recharts/,
              name: 'recharts',
            },
            {
              test: /node_modules\/pdfjs-dist/,
              name: 'pdfjs',
            },
          ],
        },
      },
    },
  },
});

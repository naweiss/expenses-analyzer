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
              test: /node_modules\/react/,
              name: 'react',
            },
            {
              test: /node_modules\/react-dom/,
              name: 'react-dom',
            },
            {
              test: /node_modules\/recharts/,
              name: 'recharts',
            },
          ],
        },
      },
    },
  },
});

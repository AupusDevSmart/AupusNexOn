import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      {
        find: /^@aupus\/shared-pages$/,
        replacement: path.resolve(__dirname, "../shared-pages/dist/index.js"),
      },
      {
        find: /^@aupus\/shared-pages\/(.*)$/,
        replacement: path.resolve(__dirname, "../shared-pages/dist") + "/$1",
      },
    ],
  },
})
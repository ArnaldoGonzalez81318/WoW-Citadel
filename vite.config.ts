import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { config as dotenvConfig } from 'dotenv'

// Load environment variables from .env file in root directory
dotenvConfig()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()]
})
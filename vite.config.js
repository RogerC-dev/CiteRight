import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          // 針對 Chrome Extension 的編譯選項
          isCustomElement: (tag) => tag.startsWith('chrome-')
        }
      }
    })
  ],
  build: {
    rollupOptions: {
      input: {
        // Vue 版本的 content script
        content: resolve(__dirname, 'src/content.js') 
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name].[ext]',
        dir: 'dist',
        format: 'iife',
        inlineDynamicImports: false
      },
      external: []
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true, // 開啟 source maps 用於除錯
    minify: false, // 保持可讀性，便於調試
    target: 'es2020', // Chrome Extension 支援的現代語法
    lib: false // 確保不會被當作庫打包
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // 確保 Vue 能正確解析
      'vue': 'vue/dist/vue.esm-bundler.js'
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    '__VUE_OPTIONS_API__': true,
    '__VUE_PROD_DEVTOOLS__': true,
    // Chrome Extension 環境標識
    'process.env.CHROME_EXTENSION': true
  },
  optimizeDeps: {
    include: ['vue', 'pinia'],
    exclude: ['@vueuse/core'] // 如果有兼容性問題可以排除
  },
  // CSS 配置簡化
  css: {
    preprocessorOptions: {
      // 如果需要可以添加 SCSS/LESS 選項
    }
  }
})

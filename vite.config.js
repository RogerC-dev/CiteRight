import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isContent = mode === 'content'

  return {
    base: '',
    plugins: [
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith('chrome-')
          }
        }
      })
    ],
    build: {
      rollupOptions: {
        input: isContent
          ? { content: resolve(__dirname, 'src/content.js') }
          : { sidepanel: resolve(__dirname, 'extension/pages/sidepanel.html') },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name]-[hash].js',
          assetFileNames: '[name].[ext]',
          dir: 'dist',
          format: isContent ? 'iife' : 'es',
          inlineDynamicImports: isContent // IIFE requires inlining
        },
        external: []
      },
      outDir: 'dist',
      emptyOutDir: isContent, // Content build runs first, so it empties dir
      sourcemap: true,
      minify: false,
      target: 'es2020',
      lib: false
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'vue': 'vue/dist/vue.esm-bundler.js'
      }
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      '__VUE_OPTIONS_API__': true,
      '__VUE_PROD_DEVTOOLS__': true,
      'process.env.CHROME_EXTENSION': true
    },
    optimizeDeps: {
      include: ['vue', 'pinia'],
      exclude: ['@vueuse/core']
    }
  }
})

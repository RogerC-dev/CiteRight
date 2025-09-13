import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 創建 Vue 應用實例
const app = createApp(App)
const pinia = createPinia()

// 使用 Pinia 狀態管理
app.use(pinia)

// 掛載應用到 DOM（針對 Chrome Extension content script）
export function mountApp(container) {
  return app.mount(container)
}

// 導出應用實例供其他模組使用
export { app, pinia }
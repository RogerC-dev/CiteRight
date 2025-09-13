<template>
  <Teleport to="body">
    <div class="notification-container">
      <TransitionGroup name="notification" tag="div">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="['notification', `notification--${notification.type}`]"
          :style="{ backgroundColor: notification.bgColor }"
        >
          <div class="notification__content">
            <div class="notification__header">
              <span class="notification__icon">{{ notification.icon }}</span>
              <span class="notification__title">{{ notification.title }}</span>
            </div>
            <div v-if="notification.subtitle" class="notification__subtitle">
              {{ notification.subtitle }}
            </div>
          </div>
          <button
            class="notification__close"
            @click="removeNotification(notification.id)"
          >
            &times;
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useExtensionStore } from '../../stores/extension.js'

const extensionStore = useExtensionStore()

// 通知列表
const notifications = ref([])
let notificationId = 0

/**
 * 顯示通知
 */
function showNotification(title, subtitle = '', type = 'info', bgColor = null, duration = 2500) {
  const id = ++notificationId
  
  // 根據類型設定預設圖示和背景色
  let icon = '📢'
  let defaultBgColor = '#389e0d'
  
  switch (type) {
    case 'success':
      icon = '✅'
      defaultBgColor = '#52c41a'
      break
    case 'warning':
      icon = '⚠️'
      defaultBgColor = '#e67e22'
      break
    case 'error':
      icon = '❌'
      defaultBgColor = '#ff4d4f'
      break
    case 'info':
    default:
      icon = extensionStore.isActivated ? '⚖️' : '❌'
      defaultBgColor = '#389e0d'
      break
  }
  
  const notification = {
    id,
    title,
    subtitle,
    type,
    icon,
    bgColor: bgColor || defaultBgColor,
    duration
  }
  
  notifications.value.push(notification)
  
  // 自動移除通知
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(id)
    }, duration)
  }
  
  return id
}

/**
 * 移除通知
 */
function removeNotification(id) {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

/**
 * 清除所有通知
 */
function clearAllNotifications() {
  notifications.value = []
}

/**
 * 顯示啟用通知
 */
function showActivationNotification(title = '台灣法源探測器已啟用', subtitle = '按住 Ctrl 鍵懸停法條查看詳情') {
  showNotification(title, subtitle, 'success', '#389e0d')
}

/**
 * 顯示停用通知  
 */
function showDeactivationNotification(title = '台灣法源探測器已停用', subtitle = '點擊右鍵選單重新啟用') {
  showNotification(title, subtitle, 'info', '#666')
}

/**
 * 顯示書籤相關通知
 */
function showBookmarkNotification(title, type = 'success') {
  let subtitle = ''
  let bgColor = '#52c41a'
  
  switch (type) {
    case 'added':
      subtitle = '已成功加入我的書籤'
      bgColor = '#52c41a'
      break
    case 'exists':
      subtitle = '此法條已經在您的書籤中'
      bgColor = '#e67e22'
      break
    case 'removed':
      subtitle = '已從書籤中移除'
      bgColor = '#ff4d4f'
      break
    case 'error':
      subtitle = '操作失敗，請稍後再試'
      bgColor = '#ff4d4f'
      break
  }
  
  showNotification(title, subtitle, type === 'error' ? 'error' : 'success', bgColor)
}

/**
 * 顯示錯誤通知
 */
function showErrorNotification(title, subtitle = '請檢查網路連線或聯繫技術支援') {
  showNotification(title, subtitle, 'error', '#ff4d4f', 3000)
}

/**
 * 處理全域事件
 */
function handleGlobalEvents() {
  // 監聽自定義事件
  window.addEventListener('citeright:notification', (event) => {
    const { title, subtitle, type, bgColor, duration } = event.detail
    showNotification(title, subtitle, type, bgColor, duration)
  })
  
  // 監聽擴充功能狀態變化
  window.addEventListener('citeright:activated', () => {
    showActivationNotification()
  })
  
  window.addEventListener('citeright:deactivated', () => {
    showDeactivationNotification()
  })
  
  // 監聽書籤事件
  window.addEventListener('citeright:bookmark-added', (event) => {
    const title = event.detail?.title || '法條'
    showBookmarkNotification(title, 'added')
  })
  
  window.addEventListener('citeright:bookmark-exists', (event) => {
    const title = event.detail?.title || '法條'
    showBookmarkNotification(title, 'exists')
  })
  
  window.addEventListener('citeright:bookmark-removed', (event) => {
    const title = event.detail?.title || '法條'
    showBookmarkNotification(title, 'removed')
  })
  
  window.addEventListener('citeright:error', (event) => {
    const { title, subtitle } = event.detail
    showErrorNotification(title, subtitle)
  })
}

/**
 * 清理全域事件
 */
function cleanupGlobalEvents() {
  window.removeEventListener('citeright:notification', () => {})
  window.removeEventListener('citeright:activated', () => {})
  window.removeEventListener('citeright:deactivated', () => {})
  window.removeEventListener('citeright:bookmark-added', () => {})
  window.removeEventListener('citeright:bookmark-exists', () => {})
  window.removeEventListener('citeright:bookmark-removed', () => {})
  window.removeEventListener('citeright:error', () => {})
}

// 生命週期
onMounted(() => {
  handleGlobalEvents()
  console.log('📢 NotificationManager 已載入')
})

onUnmounted(() => {
  cleanupGlobalEvents()
  console.log('📢 NotificationManager 已清理')
})

// 暴露方法給全域使用
if (typeof window !== 'undefined') {
  window.citerightNotifications = {
    show: showNotification,
    showActivation: showActivationNotification,
    showDeactivation: showDeactivationNotification,
    showBookmark: showBookmarkNotification,
    showError: showErrorNotification,
    remove: removeNotification,
    clear: clearAllNotifications
  }
}

// 暴露給父組件
defineExpose({
  showNotification,
  showActivationNotification,
  showDeactivationNotification,
  showBookmarkNotification,
  showErrorNotification,
  removeNotification,
  clearAllNotifications
})
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 2147483648;
  pointer-events: none;
}

.notification {
  background: #389e0d;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  padding: 12px 16px;
  border-radius: 8px;
  font-family: "Microsoft JhengHei", "Noto Sans TC", Arial, sans-serif;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  margin-bottom: 8px;
  min-width: 280px;
  max-width: 400px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  pointer-events: auto;
  backdrop-filter: blur(8px);
}

.notification--success {
  background: #52c41a;
}

.notification--warning {
  background: #e67e22;
}

.notification--error {
  background: #ff4d4f;
}

.notification--info {
  background: #389e0d;
}

.notification__content {
  flex: 1;
}

.notification__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.notification__icon {
  font-size: 16px;
  flex-shrink: 0;
}

.notification__title {
  font-weight: 600;
  line-height: 1.2;
}

.notification__subtitle {
  font-size: 12px;
  opacity: 0.9;
  line-height: 1.3;
  margin-top: 4px;
}

.notification__close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: all 0.2s;
  flex-shrink: 0;
}

.notification__close:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

/* 過渡動畫 */
.notification-enter-active {
  transition: all 0.3s ease-out;
}

.notification-leave-active {
  transition: all 0.3s ease-in;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}

/* 響應式設計 */
@media (max-width: 480px) {
  .notification-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }
  
  .notification {
    min-width: unset;
    max-width: unset;
    width: 100%;
  }
}

/* 高對比模式支援 */
@media (prefers-contrast: high) {
  .notification {
    border: 2px solid white;
  }
}

/* 減少動畫偏好 */
@media (prefers-reduced-motion: reduce) {
  .notification-enter-active,
  .notification-leave-active,
  .notification-move {
    transition: none;
  }
}
</style>
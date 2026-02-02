import { createApp } from 'vue'
import { createPinia } from 'pinia'
import SidePanelApp from './components/sidepanel/SidePanelApp.vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './style.css'

const app = createApp(SidePanelApp)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')

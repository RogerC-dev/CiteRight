// src/content.js - Vue.js-powered CiteRight content script
// Fixes Ctrl+hover sensitivity issues and implements persistent popover

import { createApp } from 'vue'
import CasePopover from './components/CasePopover.vue'

// Taiwan case patterns (same as before)
const TAIWAN_CASE_PATTERNS = {
    basic: /([0-9０-９]{2,3})\s*年度?\s*([\u4e00-\u9fa5]{1,6}?)\s*字\s*第\s*([0-9０-９]+)\s*號/g,
    constitutional: /([0-9０-９]{2,3})\s*年\s*憲判字\s*第\s*([0-9０-９]+)\s*號/g,
    interpretation: /釋字第\s*([0-9０-９]+)\s*號/g
}

// State management
class CiteRightState {
    constructor() {
        this.isCtrlPressed = false
        this.popoverApp = null
        this.currentPopover = null
        this.activeTarget = null
        this.hoverTimer = null
        this.isPinned = false
        this.lastHoveredElement = null

        this.init()
    }

    init() {
        this.setupKeyboardListeners()
        this.setupMouseListeners()
        this.setupPopover()
        this.highlightCitations()
        this.setupMutationObserver()
    }

    setupKeyboardListeners() {
        // Improved Ctrl key detection - no immediate hiding
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !this.isCtrlPressed) {
                this.isCtrlPressed = true
                console.log('🎛️ Ctrl pressed - hover mode activated')

                // Show hover hint on currently hovered element
                if (this.lastHoveredElement && this.lastHoveredElement.classList.contains('citeright-link')) {
                    this.showHoverHint(this.lastHoveredElement)
                }
            }
        })

        document.addEventListener('keyup', (e) => {
            if (!e.ctrlKey && this.isCtrlPressed) {
                this.isCtrlPressed = false
                console.log('🎛️ Ctrl released - hover mode deactivated')

                // IMPORTANT: Don't hide popover immediately on Ctrl release
                // Only hide if not pinned and not currently being hovered
                if (!this.isPinned && !this.isPopoverHovered()) {
                    this.startHideTimer()
                }

                this.hideHoverHints()
            }
        })

        // ESC to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentPopover) {
                this.hidePopover()
            }
        })
    }

    setupMouseListeners() {
        // Enhanced hover detection
        document.addEventListener('mouseover', (e) => {
            if (e.target.classList.contains('citeright-link')) {
                this.lastHoveredElement = e.target

                // Show hover hint regardless of Ctrl state
                this.showHoverHint(e.target)

                // Only show popover if Ctrl is pressed OR already pinned
                if (this.isCtrlPressed || this.isPinned) {
                    this.clearHideTimer()
                    this.showPopoverForElement(e.target)
                }
            }
        })

        document.addEventListener('mouseout', (e) => {
            if (e.target.classList.contains('citeright-link')) {
                this.hideHoverHint(e.target)

                // Only start hide timer if not pinned and Ctrl not pressed
                if (!this.isPinned && !this.isCtrlPressed) {
                    this.startHideTimer()
                }
            }
        })

        // Click to pin/unpin popover
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('citeright-link')) {
                e.preventDefault()
                this.isPinned = !this.isPinned

                if (this.isPinned) {
                    console.log('📌 Popover pinned - will stay open until X is clicked')
                    this.clearHideTimer()
                    this.showPopoverForElement(e.target)
                } else {
                    console.log('📌 Popover unpinned')
                    if (!this.isCtrlPressed) {
                        this.startHideTimer()
                    }
                }

                this.updatePinIndicator()
            }
        })
    }

    setupPopover() {
        // Create Vue app container
        const popoverContainer = document.createElement('div')
        popoverContainer.id = 'citeright-vue-container'
        document.body.appendChild(popoverContainer)

        // Create Vue app
        this.popoverApp = createApp({
            components: { CasePopover },
            data() {
                return {
                    visible: false,
                    targetElement: null,
                    caseInfo: {}
                }
            },
            methods: {
                show(element, caseInfo) {
                    this.targetElement = element
                    this.caseInfo = caseInfo
                    this.visible = true
                },
                hide() {
                    this.visible = false
                    this.targetElement = null
                    this.caseInfo = {}
                }
            },
            template: `
                <CasePopover 
                    :visible="visible" 
                    :target-element="targetElement"
                    :case-info="caseInfo"
                    @close="hide"
                />
            `
        })

        this.currentPopover = this.popoverApp.mount(popoverContainer)
    }

    showPopoverForElement(element) {
        this.activeTarget = element
        const caseInfo = this.extractCaseInfo(element)

        console.log('🎯 Showing popover for:', caseInfo)
        this.currentPopover.show(element, caseInfo)
    }

    hidePopover() {
        if (this.currentPopover) {
            this.currentPopover.hide()
            this.activeTarget = null
            this.isPinned = false
            this.clearHideTimer()
        }
    }

    startHideTimer() {
        this.clearHideTimer()
        this.hoverTimer = setTimeout(() => {
            if (!this.isPinned && !this.isPopoverHovered() && !this.isCtrlPressed) {
                this.hidePopover()
            }
        }, 300)
    }

    clearHideTimer() {
        if (this.hoverTimer) {
            clearTimeout(this.hoverTimer)
            this.hoverTimer = null
        }
    }

    isPopoverHovered() {
        const popover = document.getElementById('citeright-popover')
        return popover && popover.matches(':hover')
    }

    showHoverHint(element) {
        element.setAttribute('data-hover-hint',
            this.isCtrlPressed ? '點擊固定彈窗' : '按住 Ctrl 查看詳情')
        element.classList.add('hover-active')
    }

    hideHoverHint(element) {
        element.removeAttribute('data-hover-hint')
        element.classList.remove('hover-active')
    }

    hideHoverHints() {
        document.querySelectorAll('.citeright-link[data-hover-hint]').forEach(el => {
            this.hideHoverHint(el)
        })
    }

    updatePinIndicator() {
        const popover = document.getElementById('citeright-popover')
        if (popover) {
            popover.classList.toggle('pinned', this.isPinned)
        }
    }

    extractCaseInfo(element) {
        const { year, caseType, number } = element.dataset
        return { year, caseType, number }
    }

    // Citation highlighting (improved from original)
    highlightCitations() {
        console.log('🔍 Starting citation highlighting...')
        const seenNodes = new WeakSet()
        let created = 0

        const processTextNode = (node) => {
            if (seenNodes.has(node) || !node.parentNode) return

            const parentTag = node.parentNode.tagName
            if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parentTag)) return
            if (node.parentNode.closest && node.parentNode.closest('.citeright-link')) return

            const original = node.textContent
            if (!original || !original.trim()) return

            let newHTML = original
            let changed = false

            for (const [key, pattern] of Object.entries(TAIWAN_CASE_PATTERNS)) {
                const fresh = new RegExp(pattern.source, pattern.flags)
                newHTML = newHTML.replace(fresh, (match, ...groups) => {
                    changed = true
                    return this.makeSpan(match, key, groups)
                })
            }

            if (changed) {
                const wrapper = document.createElement('span')
                wrapper.innerHTML = newHTML
                while (wrapper.firstChild) {
                    node.parentNode.insertBefore(wrapper.firstChild, node)
                }
                node.parentNode.removeChild(node)
                created++
            }
            seenNodes.add(node)
        }

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    return /[字號釋憲判第度年]/.test(node.textContent)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT
                }
            }
        )

        const batch = []
        while (walker.nextNode()) {
            batch.push(walker.currentNode)
            if (batch.length >= 500) {
                batch.forEach(processTextNode)
                batch.length = 0
            }
        }
        if (batch.length) batch.forEach(processTextNode)

        const finalCount = document.querySelectorAll('.citeright-link').length
        console.log(`✅ Found ${finalCount} case citations (added this run: ${created})`)
        return finalCount
    }

    makeSpan(match, key, groups) {
        let year = '', caseType = '', number = ''

        if (key === 'basic') {
            year = this.toHalfWidthDigits(groups[0])
            caseType = groups[1]
            number = this.toHalfWidthDigits(groups[2])
        } else if (key === 'constitutional') {
            year = this.toHalfWidthDigits(groups[0])
            caseType = '憲判'
            number = this.toHalfWidthDigits(groups[1])
        } else if (key === 'interpretation') {
            caseType = '釋字'
            number = this.toHalfWidthDigits(groups[0])
        }

        return `<span class="citeright-link" data-year="${year}" data-case-type="${caseType}" data-number="${number}">${match}</span>`
    }

    toHalfWidthDigits(str) {
        return str.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 0x30))
    }

    setupMutationObserver() {
        const observer = new MutationObserver(mutations => {
            let textAdded = false
            for (const m of mutations) {
                if (m.type === 'childList') {
                    if ([...m.addedNodes].some(n =>
                        n.nodeType === Node.TEXT_NODE ||
                        (n.nodeType === 1 && n.innerText)
                    )) {
                        textAdded = true
                        break
                    }
                } else if (m.type === 'characterData') {
                    textAdded = true
                    break
                }
            }
            if (textAdded) {
                setTimeout(() => this.highlightCitations(), 100)
            }
        })

        try {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            })
            console.log('🔁 MutationObserver active')
        } catch (e) {
            console.warn('Observer failed to start:', e.message)
        }
    }
}

// Enhanced CSS styles
function injectStyles() {
    if (document.getElementById('citeright-vue-styles')) return

    const style = document.createElement('style')
    style.id = 'citeright-vue-styles'
    style.textContent = `
        .citeright-link {
            background-color: #e6f7ff !important;
            border-bottom: 1px dotted #91d5ff !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            padding: 1px 2px !important;
            border-radius: 2px !important;
            position: relative !important;
        }

        .citeright-link:hover,
        .citeright-link.hover-active {
            background-color: #bae7ff !important;
            border-bottom: 1px solid #40a9ff !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 4px rgba(64, 169, 255, 0.3) !important;
        }

        .citeright-link[data-hover-hint]::after {
            content: attr(data-hover-hint) !important;
            position: absolute !important;
            bottom: 100% !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            background: #333 !important;
            color: white !important;
            padding: 4px 8px !important;
            border-radius: 4px !important;
            font-size: 11px !important;
            white-space: nowrap !important;
            z-index: 1000 !important;
            pointer-events: none !important;
            opacity: 0 !important;
            animation: fadeInHint 0.2s ease forwards !important;
        }

        .citeright-link[data-hover-hint]::before {
            content: "" !important;
            position: absolute !important;
            bottom: 100% !important;
            left: 50% !important;
            transform: translateX(-50%) translateY(100%) !important;
            border: 4px solid transparent !important;
            border-top-color: #333 !important;
            z-index: 1000 !important;
            pointer-events: none !important;
            opacity: 0 !important;
            animation: fadeInHint 0.2s ease forwards !important;
        }

        @keyframes fadeInHint {
            to { opacity: 1 !important; }
        }

        #citeright-popover.pinned .citeright-header {
            background: linear-gradient(45deg, #f8f9fa, #e3f2fd) !important;
            border-bottom-color: #2196f3 !important;
        }

        #citeright-popover.pinned .popover-title::before {
            content: "📌 " !important;
        }
    `
    document.head.appendChild(style)
}

// Initialize the extension
function initializeExtension() {
    console.log('🚀 CiteRight Vue.js Extension Loading...')

    injectStyles()

    // Create global state manager
    window.citeRightState = new CiteRightState()

    console.log('✅ CiteRight Vue.js Extension Ready!')
    console.log('💡 Usage: Ctrl+Hover to preview, Click to pin popover')
}

// Debug function
window.citerightDebug = {
    highlightNow: () => window.citeRightState?.highlightCitations(),
    showState: () => console.log(window.citeRightState),
    togglePin: () => {
        if (window.citeRightState) {
            window.citeRightState.isPinned = !window.citeRightState.isPinned
            console.log('Pin state:', window.citeRightState.isPinned)
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension)
} else {
    initializeExtension()
}

export { CiteRightState, initializeExtension }

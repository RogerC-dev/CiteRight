(function () {
    'use strict';

    // Only run on ExamQuestionBank
    const IS_LOCALHOST = window.location.href.includes('localhost:5173');
    const IS_PROD = window.location.href.includes('exam-question-bank'); // Adjust based on actual prod domain if known

    if (!IS_LOCALHOST && !IS_PROD) return;

    // Check if button already exists
    if (document.getElementById('citeright-floating-btn')) return;

    console.log('CiteRight: Injecting floating button');

    // Create Button
    const btn = document.createElement('button');
    btn.id = 'citeright-floating-btn';
    btn.className = 'citeright-floating-btn';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2"/>
            <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M18 4L18.5 5.5L20 6L18.5 6.5L18 8L17.5 6.5L16 6L17.5 5.5L18 4Z" fill="currentColor"/>
            <path d="M4 2L4.35 3L5 3.35L4.35 3.7L4 4.7L3.65 3.7L3 3.35L3.65 3L4 2Z" fill="currentColor"/>
            <path d="M5 14L5.25 14.75L6 15L5.25 15.25L5 16L4.75 15.25L4 15L4.75 14.75L5 14Z" fill="currentColor"/>
        </svg>
    `;

    // Add Click Handler - Send Message directly
    // This preserves user gesture context better than postMessage
    btn.addEventListener('click', (e) => {
        // If it was a drag, don't trigger click
        if (btn.dataset.wasDragged === 'true') {
            btn.dataset.wasDragged = 'false';
            return;
        }

        console.log('CiteRight: Button clicked, opening Side Panel');
        chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('CiteRight: Error opening panel', chrome.runtime.lastError);
            } else {
                console.log('CiteRight: Panel open request sent', response);
            }
        });
    });

    // Add Drag Functionality
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    let hasMoved = false;

    btn.addEventListener('mousedown', startDrag);
    btn.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
        isDragging = true;
        hasMoved = false;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;

        const rect = btn.getBoundingClientRect();
        // Calculate offset from right/bottom interactions if currently positioned that way
        // But simpler to just switch to top/left positioning upon drag start for control

        // Get computed style to handle current position
        const style = window.getComputedStyle(btn);
        startLeft = parseInt(style.left) || rect.left;
        startTop = parseInt(style.top) || rect.top;

        // Switch to fixed left/top for dragging
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
        btn.style.left = startLeft + 'px';
        btn.style.top = startTop + 'px';
        btn.classList.add('dragging');

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }

    function onDrag(e) {
        if (!isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            hasMoved = true;
        }

        btn.style.left = (startLeft + deltaX) + 'px';
        btn.style.top = (startTop + deltaY) + 'px';

        if (e.type === 'touchmove') e.preventDefault();
    }

    function stopDrag() {
        isDragging = false;
        btn.classList.remove('dragging');

        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', stopDrag);

        if (hasMoved) {
            btn.dataset.wasDragged = 'true';
            snapToEdge();
        }
    }

    function snapToEdge() {
        // Optional: Implement snapping to left/right edge
        const rect = btn.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const midX = screenWidth / 2;

        const targetX = (rect.left + rect.width / 2 < midX) ? 24 : screenWidth - rect.width - 24;

        // Simple animation
        btn.style.transition = 'left 0.3s ease';
        btn.style.left = targetX + 'px';

        // Re-enable none transition after snap
        setTimeout(() => {
            btn.style.transition = 'none';
        }, 300);
    }

    document.body.appendChild(btn);

})();

// theme-manager.js - Loads instantly in head to prevent FOUC
(function() {
    const savedTheme = localStorage.getItem('eduBridgeTheme');
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
        // Wait for body to be available and apply it there as well if needed
        window.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('light-theme');
        });
    }
})();

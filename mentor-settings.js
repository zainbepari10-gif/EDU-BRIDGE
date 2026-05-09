document.addEventListener("DOMContentLoaded", () => {
    // ---- AUTHENTICATION CHECK ----
    const currentUserEmail = localStorage.getItem('currentUser');
    const currentRole = localStorage.getItem('currentRole');
    
    if (!currentUserEmail || currentRole !== 'mentor') {
        window.location.href = 'index.html';
        return;
    }

    let userData = JSON.parse(localStorage.getItem(`user_${currentUserEmail}`)) || {
        name: currentUserEmail.split('@')[0],
        email: currentUserEmail,
        subject: "General Studies"
    };

    // ---- POPULATE PROFILE ----
    const avatarEl = document.getElementById('userAvatar');
    const settingsAvatar = document.getElementById('settingsAvatar');
    const userNameEl = document.getElementById('userName');
    
    const settingsName = document.getElementById('settingsName');
    const settingsEmail = document.getElementById('settingsEmail');
    const settingsSubject = document.getElementById('settingsSubject');

    function updateProfileUI() {
        if (avatarEl) avatarEl.src = `https://ui-avatars.com/api/?name=${userData.name}&background=00e1ff&color=fff`;
        if (settingsAvatar) settingsAvatar.src = `https://ui-avatars.com/api/?name=${userData.name}&background=00e1ff&color=fff&size=150`;
        if (userNameEl) userNameEl.textContent = `Prof. ${userData.name}`;
        
        if (settingsName) settingsName.value = userData.name;
        if (settingsEmail) settingsEmail.value = userData.email || currentUserEmail;
        if (settingsSubject) settingsSubject.value = userData.subject || "Not specified";
    }
    updateProfileUI();

    // ---- TAB SWITCHING LOGIC ----
    const tabs = document.querySelectorAll('.settings-tab');
    const panes = document.querySelectorAll('.settings-content-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const target = document.getElementById(`${tab.getAttribute('data-tab')}-tab`);
            if (target) target.classList.add('active');
        });
    });

    // ---- THEME SWITCHER LOGIC ----
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        // Initialize state
        const currentTheme = localStorage.getItem('eduBridgeTheme');
        if (currentTheme === 'light') {
            themeToggle.checked = true;
            document.body.classList.add('light-theme');
        }

        themeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('light-theme');
                document.documentElement.classList.add('light-theme');
                localStorage.setItem('eduBridgeTheme', 'light');
            } else {
                document.body.classList.remove('light-theme');
                document.documentElement.classList.remove('light-theme');
                localStorage.setItem('eduBridgeTheme', 'dark');
            }
        });
    }

    // ---- SAVE PROFILE ----
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', () => {
            const originalText = saveProfileBtn.innerHTML;
            saveProfileBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Saving...</span><div class="btn-glow"></div>';
            
            setTimeout(() => {
                userData.name = settingsName.value;
                userData.subject = settingsSubject.value;
                localStorage.setItem(`user_${currentUserEmail}`, JSON.stringify(userData));
                
                updateProfileUI();
                saveProfileBtn.innerHTML = '<span><i class="fa-solid fa-check"></i> Saved</span><div class="btn-glow"></div>';
                
                setTimeout(() => {
                    saveProfileBtn.innerHTML = originalText;
                }, 2000);
            }, 800);
        });
    }

    // ---- LOGOUT ----
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentRole');
            window.location.href = 'index.html';
        });
    }
});

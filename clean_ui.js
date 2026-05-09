const fs = require('fs');
const path = require('path');

const student_files = ['dashboard.html', 'assignments.html', 'notes.html', 'settings.html'];
const mentor_files = ['mentor-dashboard.html', 'mentor-students.html', 'mentor-assignments.html', 'mentor-doubts.html', 'mentor-notes.html', 'mentor-analytics.html', 'mentor-ai.html', 'mentor-settings.html'];

function getStudentSidebar(filename) {
    const isDash = filename === 'dashboard.html' ? 'class="active"' : '';
    const isAss = filename === 'assignments.html' ? 'class="active"' : '';
    const isNotes = filename === 'notes.html' ? 'class="active"' : '';
    const isSet = filename === 'settings.html' ? 'class="active"' : '';
    
    const nav = `            <nav class="sidebar-nav">
                <a href="dashboard.html" ${isDash}><i class="fa-solid fa-house"></i> Dashboard</a>
                <a href="assignments.html" ${isAss}><i class="fa-solid fa-book-open"></i> Assignments</a>
                <a href="notes.html" ${isNotes}><i class="fa-solid fa-folder-open"></i> Notes</a>
                <a href="#"><i class="fa-solid fa-chart-pie"></i> Study Analytics</a>
                <a href="#"><i class="fa-solid fa-bullseye"></i> Goals</a>
                <a href="#" class="ai-link"><i class="fa-solid fa-robot"></i> AI Assistant</a>
            </nav>`;
            
    const bottom = `            <div class="sidebar-bottom">
                <a href="settings.html" ${isSet}><i class="fa-solid fa-gear"></i> Settings</a>
                <a href="#" id="logoutBtn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</a>
            </div>`;
    return { nav, bottom };
}

function getMentorSidebar(filename) {
    const isDash = filename === 'mentor-dashboard.html' ? 'class="active"' : '';
    const isStud = filename === 'mentor-students.html' ? 'class="active"' : '';
    const isAss = filename === 'mentor-assignments.html' ? 'class="active"' : '';
    const isNotes = filename === 'mentor-notes.html' ? 'class="active"' : '';
    const isDoubts = filename === 'mentor-doubts.html' ? 'class="active"' : '';
    const isAnal = filename === 'mentor-analytics.html' ? 'class="active"' : '';
    const isAi = filename === 'mentor-ai.html' ? 'class="active ai-link"' : 'class="ai-link"';
    const isSet = filename === 'mentor-settings.html' ? 'class="active"' : '';

    const nav = `            <nav class="sidebar-nav">
                <a href="mentor-dashboard.html" ${isDash}><i class="fa-solid fa-house"></i> Dashboard</a>
                <a href="mentor-students.html" ${isStud}><i class="fa-solid fa-users"></i> Students</a>
                <a href="mentor-assignments.html" ${isAss}><i class="fa-solid fa-book-open"></i> Assignments</a>
                <a href="mentor-notes.html" ${isNotes}><i class="fa-solid fa-folder-open"></i> Notes & Resources</a>
                <a href="mentor-doubts.html" ${isDoubts}><i class="fa-solid fa-circle-question"></i> Student Doubts</a>
                <a href="mentor-analytics.html" ${isAnal}><i class="fa-solid fa-chart-line"></i> Productivity & Analytics</a>
                <a href="mentor-ai.html" ${isAi}><i class="fa-solid fa-robot"></i> AI Insights</a>
            </nav>`;
            
    const bottom = `            <div class="sidebar-bottom">
                <a href="mentor-settings.html" ${isSet}><i class="fa-solid fa-gear"></i> Settings</a>
                <a href="#" id="logoutBtn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</a>
            </div>`;
    return { nav, bottom };
}

function processFile(filepath, isMentor) {
    const filename = path.basename(filepath);
    if (!fs.existsSync(filepath)) return;
    
    let content = fs.readFileSync(filepath, 'utf-8');
    const { nav, bottom } = isMentor ? getMentorSidebar(filename) : getStudentSidebar(filename);
        
    content = content.replace(/<nav class="sidebar-nav">[\s\S]*?<\/nav>/, nav);
    content = content.replace(/<div class="sidebar-bottom">[\s\S]*?<\/div>/, bottom);
    
    // Remove topbar bell (using robust regex for variable spaces)
    content = content.replace(/<button class="icon-btn"[^>]*>\s*<i class="fa-solid fa-bell"><\/i>\s*<\/button>\s*/g, '');
    content = content.replace(/<button[^>]*>\s*<i class="fa-solid fa-bell"><\/i>\s*<\/button>\s*/g, '');

    // In settings files, remove notification tab and pane
    if (filename === 'settings.html' || filename === 'mentor-settings.html') {
        content = content.replace(/<div class="settings-tab"\s+data-tab="notifications">[\s\S]*?<\/div>\s*/, '');
        content = content.replace(/<!-- Notifications Tab -->\s*<div id="notifications-tab" class="settings-content-pane">[\s\S]*?<\/div>\s*(?=<!-- Privacy Tab -->)/, '');
    }

    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`Processed ${filename}`);
}

student_files.forEach(f => processFile(f, false));
mentor_files.forEach(f => processFile(f, true));
console.log('Done cleaning.');

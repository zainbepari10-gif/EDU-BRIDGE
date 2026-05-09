import os
import re

student_files = ['dashboard.html', 'assignments.html', 'notes.html', 'settings.html']
mentor_files = ['mentor-dashboard.html', 'mentor-students.html', 'mentor-assignments.html', 'mentor-doubts.html', 'mentor-notes.html', 'mentor-analytics.html', 'mentor-ai.html', 'mentor-settings.html']

def get_student_sidebar(filename):
    is_dash = 'class="active"' if filename == 'dashboard.html' else ''
    is_ass = 'class="active"' if filename == 'assignments.html' else ''
    is_notes = 'class="active"' if filename == 'notes.html' else ''
    is_set = 'class="active"' if filename == 'settings.html' else ''
    
    # We also keep ai-link on AI Assistant
    
    nav = f"""            <nav class="sidebar-nav">
                <a href="dashboard.html" {is_dash}><i class="fa-solid fa-house"></i> Dashboard</a>
                <a href="assignments.html" {is_ass}><i class="fa-solid fa-book-open"></i> Assignments</a>
                <a href="notes.html" {is_notes}><i class="fa-solid fa-folder-open"></i> Notes</a>
                <a href="#"><i class="fa-solid fa-chart-pie"></i> Study Analytics</a>
                <a href="#"><i class="fa-solid fa-bullseye"></i> Goals</a>
                <a href="#" class="ai-link"><i class="fa-solid fa-robot"></i> AI Assistant</a>
            </nav>"""
            
    bottom = f"""            <div class="sidebar-bottom">
                <a href="settings.html" {is_set}><i class="fa-solid fa-gear"></i> Settings</a>
                <a href="#" id="logoutBtn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</a>
            </div>"""
    return nav, bottom

def get_mentor_sidebar(filename):
    is_dash = 'class="active"' if filename == 'mentor-dashboard.html' else ''
    is_stud = 'class="active"' if filename == 'mentor-students.html' else ''
    is_ass = 'class="active"' if filename == 'mentor-assignments.html' else ''
    is_notes = 'class="active"' if filename == 'mentor-notes.html' else ''
    is_doubts = 'class="active"' if filename == 'mentor-doubts.html' else ''
    is_anal = 'class="active"' if filename == 'mentor-analytics.html' else ''
    is_ai = 'class="active ai-link"' if filename == 'mentor-ai.html' else 'class="ai-link"'
    is_set = 'class="active"' if filename == 'mentor-settings.html' else ''

    nav = f"""            <nav class="sidebar-nav">
                <a href="mentor-dashboard.html" {is_dash}><i class="fa-solid fa-house"></i> Dashboard</a>
                <a href="mentor-students.html" {is_stud}><i class="fa-solid fa-users"></i> Students</a>
                <a href="mentor-assignments.html" {is_ass}><i class="fa-solid fa-book-open"></i> Assignments</a>
                <a href="mentor-notes.html" {is_notes}><i class="fa-solid fa-folder-open"></i> Notes & Resources</a>
                <a href="mentor-doubts.html" {is_doubts}><i class="fa-solid fa-circle-question"></i> Student Doubts</a>
                <a href="mentor-analytics.html" {is_anal}><i class="fa-solid fa-chart-line"></i> Productivity & Analytics</a>
                <a href="mentor-ai.html" {is_ai}><i class="fa-solid fa-robot"></i> AI Insights</a>
            </nav>"""
            
    bottom = f"""            <div class="sidebar-bottom">
                <a href="mentor-settings.html" {is_set}><i class="fa-solid fa-gear"></i> Settings</a>
                <a href="#" id="logoutBtn"><i class="fa-solid fa-arrow-right-from-bracket"></i> Logout</a>
            </div>"""
    return nav, bottom

def process_file(filepath, is_mentor):
    filename = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Replace sidebar-nav
    if is_mentor:
        nav, bottom = get_mentor_sidebar(filename)
    else:
        nav, bottom = get_student_sidebar(filename)
        
    # Regex to replace <nav class="sidebar-nav">...</nav>
    content = re.sub(r'<nav class="sidebar-nav">.*?</nav>', nav, content, flags=re.DOTALL)
    
    # Regex to replace <div class="sidebar-bottom">...</div>
    content = re.sub(r'<div class="sidebar-bottom">.*?</div>', bottom, content, flags=re.DOTALL)
    
    # Remove topbar bell
    content = re.sub(r'<button class="icon-btn"[^>]*>\s*<i class="fa-solid fa-bell"></i>\s*</button>\s*', '', content)
    # Also remove any icon-btn just containing bell (without class attr restrictions)
    content = re.sub(r'<button[^>]*>\s*<i class="fa-solid fa-bell"></i>\s*</button>\s*', '', content)

    # In settings files, remove notification tab and pane
    if filename in ['settings.html', 'mentor-settings.html']:
        content = re.sub(r'<div class="settings-tab"\s+data-tab="notifications">.*?</div>\s*', '', content, flags=re.DOTALL)
        content = re.sub(r'<!-- Notifications Tab -->\s*<div id="notifications-tab" class="settings-content-pane">.*?</div>\s*(?=<!-- Privacy Tab -->)', '', content, flags=re.DOTALL)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Processed {filename}")

for f in student_files:
    if os.path.exists(f):
        process_file(f, False)

for f in mentor_files:
    if os.path.exists(f):
        process_file(f, True)

print("Done cleaning.")

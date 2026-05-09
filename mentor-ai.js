document.addEventListener("DOMContentLoaded", () => {
    // ---- AUTHENTICATION CHECK ----
    const currentUserEmail = localStorage.getItem('currentUser');
    const currentRole = localStorage.getItem('currentRole');

    if (!currentUserEmail || currentRole !== 'mentor') {
        window.location.href = 'index.html';
        return;
    }

    let mentorData = JSON.parse(localStorage.getItem(`user_${currentUserEmail}`)) || {
        name: currentUserEmail.split('@')[0],
        role: 'mentor'
    };

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = `Prof. ${mentorData.name}`;

    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${mentorData.name}&background=00e1ff&color=fff`;

    // ---- DOM ELEMENTS ----
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const promptChips = document.querySelectorAll('.prompt-chip');

    // Auto-resize textarea
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        sendBtn.disabled = this.value.trim().length === 0;
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    sendBtn.addEventListener('click', handleSend);

    clearChatBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to clear the conversation history?")) {
            chatHistory.innerHTML = `
                <div class="chat-bubble ai">
                    <div class="chat-avatar ai"><i class="fa-solid fa-robot"></i></div>
                    <div class="chat-content">
                        <h4>EduBridge AI</h4>
                        <p>Conversation cleared. How can I help you today?</p>
                    </div>
                </div>
            `;
        }
    });

    promptChips.forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.textContent;
            chatInput.style.height = 'auto';
            sendBtn.disabled = false;
            handleSend();
        });
    });

    // ---- DATA ACCESS LAYER ----
    function getLocalData(keyName, defaultData = []) {
        try {
            const raw = localStorage.getItem(`${keyName}_${currentUserEmail}`);
            return raw ? JSON.parse(raw) : defaultData;
        } catch (e) { return defaultData; }
    }

    // ---- CHAT LOGIC ----
    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        // 1. Add User Message
        appendMessage('user', text);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        sendBtn.disabled = true;

        // Scroll to bottom
        scrollToBottom();

        // 2. Show Typing Indicator
        const typingId = showTypingIndicator();
        scrollToBottom();

        // 3. Process AI Response (Simulate network delay)
        await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 1000));
        
        removeTypingIndicator(typingId);
        
        const responseHTML = generateAIResponse(text);
        appendMessage('ai', responseHTML, true);
        scrollToBottom();
    }

    function appendMessage(role, content, isHTML = false) {
        const div = document.createElement('div');
        div.className = `chat-bubble ${role}`;
        
        const avatar = role === 'ai' 
            ? `<div class="chat-avatar ai"><i class="fa-solid fa-robot"></i></div>`
            : `<div class="chat-avatar user"><i class="fa-solid fa-user"></i></div>`;
            
        const name = role === 'ai' ? 'EduBridge AI' : `Prof. ${mentorData.name}`;
        
        let formattedContent = content;
        if (!isHTML) {
            // Basic markdown-like formatting for text
            formattedContent = content
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        }

        div.innerHTML = `
            ${avatar}
            <div class="chat-content">
                <h4>${name}</h4>
                <div class="message-text">${formattedContent}</div>
            </div>
        `;
        
        chatHistory.appendChild(div);
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const div = document.createElement('div');
        div.className = `chat-bubble ai`;
        div.id = id;
        div.innerHTML = `
            <div class="chat-avatar ai"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-content" style="display: flex; align-items: center;">
                <h4>EduBridge AI</h4>
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        chatHistory.appendChild(div);
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // ---- AI RESPONSE ENGINE ----
    function generateAIResponse(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        
        // 1. Detect Low Performing Students
        if (lowerPrompt.includes('low') || lowerPrompt.includes('perform') || lowerPrompt.includes('falling behind')) {
            const students = getLocalData('mentor_students', [
                { id: "mock_s3", name: "Rahul Verma", course: "Mathematics", productivity: 45, status: "Active" }
            ]);
            
            const lowPerformers = students.filter(s => (s.productivity || 0) < 60);
            
            if (lowPerformers.length === 0) {
                return "<p>Great news! I scanned your current student roster and couldn't find any students falling below the 60% productivity threshold. Everyone seems to be on track.</p>";
            }

            let html = `<p>I've analyzed your roster. I found <strong>${lowPerformers.length}</strong> student(s) currently falling below the 60% productivity threshold:</p><br>`;
            html += `<ul style="list-style-type: none; padding: 0; display: flex; flex-direction: column; gap: 10px;">`;
            
            lowPerformers.forEach(s => {
                html += `
                    <li style="background: rgba(255,51,102,0.1); border-left: 3px solid var(--danger); padding: 10px; border-radius: 6px;">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${s.name} (${s.course})</strong>
                            <span style="color: var(--danger); font-weight: bold;">${s.productivity}%</span>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px;">Recommendation: Schedule a 1-on-1 check-in to discuss recent missed assignments.</div>
                    </li>
                `;
            });
            html += `</ul><p style="margin-top: 15px;">Would you like me to draft a check-in email for these students?</p>`;
            return html;
        }

        // 2. Summarize Doubts
        if (lowerPrompt.includes('doubt') || lowerPrompt.includes('summarize')) {
            const doubts = getLocalData('mentor_doubts', [
                { studentName: "Priya Patel", subject: "Physics", status: "Unresolved", message: "I'm having trouble understanding projectile motion formulas." }
            ]);
            
            const unresolved = doubts.filter(d => d.status === 'Unresolved' || d.status === 'Pending');
            
            if (unresolved.length === 0) {
                return "<p>You're all caught up! There are currently <strong>no unresolved doubts</strong> in your queue.</p>";
            }

            let html = `<p>You currently have <strong>${unresolved.length} pending doubts</strong>. Here is a quick summary:</p><br>`;
            html += `<div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 10px;">`;
            
            unresolved.forEach(d => {
                html += `
                    <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px; margin-bottom: 5px;">
                        <strong style="color: var(--primary-blue);">${d.subject}</strong> - from ${d.studentName}
                        <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-top: 5px;">"${d.message}"</p>
                    </div>
                `;
            });
            html += `</div><p style="margin-top: 15px;">You can reply to them directly from the <a href="mentor-doubts.html" style="color: var(--primary-purple);">Student Doubts</a> panel.</p>`;
            return html;
        }

        // 3. Generate Assignment / Plan
        if (lowerPrompt.includes('assignment') || lowerPrompt.includes('generate') || lowerPrompt.includes('plan')) {
            const subjectMatch = prompt.match(/(physics|math|chemistry|computer science|biology)/i);
            const subject = subjectMatch ? subjectMatch[0] : "General Studies";
            
            return `
                <p>Absolutely! Here is a draft assignment structure for <strong>${subject}</strong>:</p>
                <div style="background: rgba(157,0,255,0.05); border: 1px solid var(--primary-purple); padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h3 style="color: var(--primary-blue); margin-bottom: 10px;">Assignment: Core Principles of ${subject}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px;">Estimated completion time: 2 Hours</p>
                    <ul style="padding-left: 20px; color: var(--text-main); font-size: 0.9rem;">
                        <li style="margin-bottom: 5px;"><strong>Part 1: Conceptual Understanding</strong> (30 mins) - Define key terminologies and basic theorems.</li>
                        <li style="margin-bottom: 5px;"><strong>Part 2: Practical Application</strong> (45 mins) - Solve 3 scenario-based problems.</li>
                        <li style="margin-bottom: 5px;"><strong>Part 3: Critical Thinking</strong> (45 mins) - Write a short analysis on a real-world application.</li>
                    </ul>
                </div>
                <p>I can also generate a downloadable PDF of this assignment if you'd like to publish it to your class right now.</p>
            `;
        }

        // 4. Productivity Overview
        if (lowerPrompt.includes('overview') || lowerPrompt.includes('productivity') || lowerPrompt.includes('stats')) {
            const students = getLocalData('mentor_students', [{ productivity: 85 }, { productivity: 45 }, { productivity: 92 }]);
            let totalProd = 0;
            students.forEach(s => totalProd += (s.productivity || 0));
            const avgProd = students.length > 0 ? Math.round(totalProd / students.length) : 0;
            
            return `
                <p>Here is your current class overview:</p>
                <ul style="margin-top: 10px; padding-left: 20px;">
                    <li><strong>Class Average Productivity:</strong> <span style="color: ${avgProd > 70 ? 'var(--success)' : 'var(--warning)'}; font-weight: bold;">${avgProd}%</span></li>
                    <li><strong>Active Students:</strong> ${students.length}</li>
                </ul>
                <p style="margin-top: 10px;">Overall, your class is performing well. To see a detailed 7-day trend, please visit the <a href="mentor-analytics.html" style="color: var(--primary-purple);">Productivity Analytics</a> page.</p>
            `;
        }

        // Fallback generic response
        return `
            <p>I understand you're asking about: <em>"${prompt}"</em></p>
            <p style="margin-top: 10px;">As your AI Assistant, I can help you with:</p>
            <ul style="margin-top: 10px; padding-left: 20px; color: var(--text-muted); font-size: 0.9rem;">
                <li>Scanning your roster for low-performing students</li>
                <li>Summarizing active student doubts</li>
                <li>Generating new assignment structures</li>
                <li>Providing class productivity overviews</li>
            </ul>
            <p style="margin-top: 10px;">Try asking me something like <strong>"Analyze low-performing students"</strong> or <strong>"Summarize unresolved doubts"</strong>.</p>
        `;
    }

});

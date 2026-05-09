import { db, storage } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
    // Mock Database for Notes (Simulating Firebase Firestore)
    const mockNotesDB = {
        "Mathematics": [
            {
                id: "math_ch1",
                chapterNumber: 1,
                chapterName: "Matrices",
                mentorName: "Prof. Sharma",
                uploadDate: "14 May 2026",
                pdfSize: "2.4 MB",
                pdfUrl: "#"
            }
        ],
        "Physics": [
            {
                id: "phy_ch3",
                chapterNumber: 3,
                chapterName: "Modern Physics",
                mentorName: "Prof. Mehta",
                uploadDate: "12 May 2026",
                pdfSize: "3.1 MB",
                pdfUrl: "#"
            }
        ],
        "Chemistry": [
            {
                id: "chem_ch5",
                chapterNumber: 5,
                chapterName: "Chemical Bonding",
                mentorName: "Prof. Iyer",
                uploadDate: "10 May 2026",
                pdfSize: "1.8 MB",
                pdfUrl: "#"
            }
        ],
        "Computer Science": [
            {
                id: "cs_ch2",
                chapterNumber: 2,
                chapterName: "Data Structures",
                mentorName: "Prof. Khan",
                uploadDate: "16 May 2026",
                pdfSize: "4.2 MB",
                pdfUrl: "#"
            }
        ]
    };

    const notesSubjectContainer = document.getElementById('notesSubjectContainer');
    const emptyStateNotes = document.getElementById('emptyStateNotes');
    const subjectFilter = document.getElementById('subjectFilter');
    const notesSearch = document.getElementById('notesSearch');

    // PDF Viewer Elements
    const pdfViewerModal = document.getElementById('pdfViewerModal');
    const closePdfBtn = document.getElementById('closePdfBtn');
    const pdfViewerTitle = document.getElementById('pdfViewerTitle');
    const pdfViewerMeta = document.getElementById('pdfViewerMeta');
    const mockPdfTitle = document.getElementById('mockPdfTitle');
    
    // Load Doubts from Firestore
    function loadDoubts(noteId, container) {
        const currentUserEmail = localStorage.getItem('currentUser') || 'student@edubridge.com';
        
        let subject = "General";
        let chapter = "General";
        for (const subj of Object.keys(mockNotesDB)) {
            const found = mockNotesDB[subj].find(n => n.id === noteId);
            if (found) {
                subject = subj;
                chapter = found.chapterName;
                break;
            }
        }

        try {
            if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                throw new Error("Firebase not configured");
            }
            const q = query(
                collection(db, "doubts"), 
                where("studentId", "==", currentUserEmail),
                where("chapterName", "==", chapter)
            );

            onSnapshot(q, (snapshot) => {
                container.innerHTML = '';
                let hasDoubts = false;
                
                snapshot.forEach((doc) => {
                    hasDoubts = true;
                    renderDoubtDiscussionCard(doc.data(), container);
                });

                if (!hasDoubts) {
                    renderEmptyDoubtState(container);
                }
            }, (error) => {
                throw error;
            });
        } catch (error) {
            // Local fallback
            console.log("Using localStorage fallback for doubts reading");
            let doubts = [];
            try {
                const stored = localStorage.getItem(`doubts_${noteId}`);
                if (stored) doubts = JSON.parse(stored);
            } catch(e) {}
            
            container.innerHTML = '';
            if (doubts.length === 0) {
                renderEmptyDoubtState(container);
            } else {
                // Since fallback array might have history, we map it to the new unified structure
                // Taking the first student message as the doubt, and any mentorReply fields
                let doubtObj = {
                    doubtMessage: doubts[0].text || doubts[0].doubtMessage,
                    timestamp: doubts[0].timestamp,
                    status: doubts[0].status || "Unresolved",
                    mentorReply: doubts[0].mentorReply,
                    mentorReplyTimestamp: doubts[0].mentorReplyTimestamp,
                    explanationPdfUrl: doubts[0].explanationPdfUrl
                };
                
                // If there's an old-style mentor reply in the array
                if (!doubtObj.mentorReply && doubts.length > 1) {
                    const mentorMsgs = doubts.filter(d => d.sender === 'mentor');
                    if (mentorMsgs.length > 0) {
                        const lastMentorMsg = mentorMsgs[mentorMsgs.length - 1];
                        doubtObj.mentorReply = lastMentorMsg.text;
                        doubtObj.mentorReplyTimestamp = lastMentorMsg.timestamp;
                        doubtObj.status = "Resolved";
                    }
                }

                renderDoubtDiscussionCard(doubtObj, container);
            }
            
            // Re-render when local storage updates in this tab or another
            window.addEventListener('storage', (e) => {
                if (e.key === `doubts_${noteId}`) {
                    // prevent infinite loops if we are just rendering
                    setTimeout(() => loadDoubts(noteId, container), 50);
                }
            });
        }
    }

    function renderEmptyDoubtState(container) {
        container.innerHTML = `
            <div class="empty-state-alert glass-panel" style="padding: 20px; text-align: center;">
                <div style="font-size: 2rem; color: var(--primary-purple); margin-bottom: 10px;">
                    <i class="fa-solid fa-comments"></i>
                </div>
                <h4 style="color: var(--text-main); margin-bottom: 5px;">No doubts asked yet.</h4>
                <p style="color: var(--text-muted); font-size: 0.9rem;">Ask your mentor about this chapter above.</p>
            </div>
        `;
    }

    function renderDoubtDiscussionCard(data, container) {
        const systemMsg = container.querySelector('.empty-state-alert');
        if (systemMsg) systemMsg.remove();

        const cardDiv = document.createElement('div');
        cardDiv.className = 'doubt-discussion-card glass-panel';
        cardDiv.style.margin = '15px 0';
        cardDiv.style.padding = '20px';
        cardDiv.style.borderRadius = '12px';
        cardDiv.style.borderLeft = '4px solid var(--primary-purple)';
        cardDiv.style.background = 'rgba(255, 255, 255, 0.03)';
        
        const timestamp = data.timestamp ? (data.timestamp.toMillis ? data.timestamp.toMillis() : data.timestamp) : Date.now();
        const dateStr = new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let statusHtml = '';
        let mentorSection = '';

        if (data.status === 'Resolved' || data.mentorReply) {
            statusHtml = `<span class="status-badge status-green"><i class="fa-solid fa-check-circle"></i> Resolved</span>`;
            
            const replyTime = data.mentorReplyTimestamp ? (data.mentorReplyTimestamp.toMillis ? data.mentorReplyTimestamp.toMillis() : data.mentorReplyTimestamp) : Date.now();
            const replyDateStr = new Date(replyTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const replyTimeStr = new Date(replyTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            mentorSection = `
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="color: var(--primary-blue); font-size: 0.85rem; font-weight: 600; margin-bottom: 5px;"><i class="fa-solid fa-user-graduate"></i> Mentor Reply:</div>
                    <p style="color: var(--text-main); font-size: 0.95rem; line-height: 1.5; margin-bottom: 15px;">"${data.mentorReply}"</p>
                    ${data.explanationPdfUrl && data.explanationPdfUrl !== "" ? `
                        <button class="btn-small outline view-explanation-btn" data-url="${data.explanationPdfUrl}" style="margin-bottom: 15px; border-color: var(--primary-blue); color: var(--primary-blue);">
                            <i class="fa-solid fa-file-pdf"></i> View Explanation PDF
                        </button>
                    ` : ''}
                    <div style="color: var(--text-muted); font-size: 0.75rem;"><i class="fa-regular fa-clock"></i> Replied: ${replyDateStr} • ${replyTimeStr}</div>
                </div>
            `;
        } else {
            statusHtml = `<span class="status-badge status-yellow"><i class="fa-solid fa-hourglass-half"></i> Waiting for mentor reply...</span>`;
        }

        cardDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                <div>
                    <div style="color: var(--primary-purple); font-size: 0.85rem; font-weight: 600; margin-bottom: 5px;">Your Doubt:</div>
                    <p style="color: var(--text-main); font-size: 0.95rem; line-height: 1.5;">"${data.doubtMessage || data.text}"</p>
                </div>
                <div>${statusHtml}</div>
            </div>
            <div style="color: var(--text-muted); font-size: 0.75rem;"><i class="fa-regular fa-clock"></i> Sent: ${dateStr} • ${timeStr}</div>
            ${mentorSection}
        `;

        container.appendChild(cardDiv);

        const explanationBtn = cardDiv.querySelector('.view-explanation-btn');
        if (explanationBtn) {
            explanationBtn.addEventListener('click', (e) => {
                const url = e.currentTarget.getAttribute('data-url');
                if (url === 'mock_local_file_url') {
                    alert('PDF Viewer Mock: The mentor attached an explanation file locally.');
                } else if (url && url !== '#') {
                    window.open(url, '_blank');
                }
            });
        }
        container.scrollTop = container.scrollHeight;
    }

    // Render Notes
    function renderNotes(filterSubject = 'all', searchQuery = '') {
        if (!notesSubjectContainer) return;
        notesSubjectContainer.innerHTML = '';
        let hasNotes = false;

        for (const [subject, notes] of Object.entries(mockNotesDB)) {
            if (filterSubject !== 'all' && subject !== filterSubject) continue;

            const filteredNotes = notes.filter(note => 
                note.chapterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                `Chapter ${note.chapterNumber}`.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (filteredNotes.length === 0) continue;
            hasNotes = true;

            const subjectSection = document.createElement('div');
            subjectSection.className = 'notes-subject-section';
            
            const subjectHeader = document.createElement('h3');
            subjectHeader.className = 'subject-title';
            subjectHeader.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${subject}`;
            subjectSection.appendChild(subjectHeader);

            const listContainer = document.createElement('div');
            listContainer.className = 'notes-list-container';

            filteredNotes.forEach(note => {
                const noteBlock = document.createElement('div');
                noteBlock.className = 'note-block';

                // Horizontal Card
                const card = document.createElement('div');
                card.className = 'note-card-horizontal glass-panel';
                card.innerHTML = `
                    <div class="note-card-left">
                        <div class="note-icon-large"><i class="fa-solid fa-file-pdf"></i></div>
                        <div class="note-card-info">
                            <span class="note-meta-badge">Chapter ${note.chapterNumber}</span>
                            <h4 class="note-title-horiz">${note.chapterName}</h4>
                            <div class="note-details-inline">
                                <span><i class="fa-solid fa-chalkboard-user"></i> Uploaded by: ${note.mentorName}</span>
                                <span><i class="fa-regular fa-calendar"></i> Uploaded: ${note.uploadDate}</span>
                                <span><i class="fa-solid fa-weight-hanging"></i> PDF Size: ${note.pdfSize}</span>
                            </div>
                        </div>
                    </div>
                    <div class="note-card-right">
                        <button class="btn-small outline view-pdf-btn" data-id="${note.id}">
                            <i class="fa-regular fa-eye"></i> View PDF
                        </button>
                        <button class="icon-btn download-btn tooltip" data-tip="Download">
                            <i class="fa-solid fa-download"></i>
                        </button>
                    </div>
                `;

                // AI Tools Bar
                const aiTools = document.createElement('div');
                aiTools.className = 'note-ai-tools';
                aiTools.innerHTML = `
                    <button class="btn-micro ai-btn"><i class="fa-solid fa-wand-magic-sparkles"></i> Summarize Chapter</button>
                    <button class="btn-micro ai-btn"><i class="fa-solid fa-star"></i> Important Questions</button>
                    <button class="btn-micro ai-btn"><i class="fa-solid fa-brain"></i> Explain Topic</button>
                `;

                // Doubt Panel (Below card)
                const doubtPanel = document.createElement('div');
                doubtPanel.className = 'inline-doubt-panel glass-panel';
                doubtPanel.innerHTML = `
                    <div class="inline-doubt-header">
                        <h4><i class="fa-solid fa-circle-question"></i> Ask doubt related to this chapter</h4>
                    </div>
                    <div class="inline-doubt-history" id="history_${note.id}"></div>
                    <div class="inline-doubt-input">
                        <textarea id="input_${note.id}" placeholder="Type your doubt here..." rows="2"></textarea>
                        <div class="inline-doubt-actions">
                            <input type="file" id="file_${note.id}" style="display: none;" accept="image/*">
                            <button class="btn-small attach-btn" data-id="${note.id}"><i class="fa-solid fa-paperclip"></i> <span id="fileName_${note.id}">Attach Screenshot</span></button>
                            <button class="glow-btn send-doubt-inline" data-id="${note.id}">
                                <span><i class="fa-solid fa-paper-plane"></i> Send to Mentor</span>
                                <div class="btn-glow"></div>
                            </button>
                        </div>
                    </div>
                `;

                noteBlock.appendChild(card);
                noteBlock.appendChild(aiTools);
                noteBlock.appendChild(doubtPanel);
                listContainer.appendChild(noteBlock);
            });

            subjectSection.appendChild(listContainer);
            notesSubjectContainer.appendChild(subjectSection);
        }

        if (!hasNotes && emptyStateNotes) {
            emptyStateNotes.style.display = 'flex';
        } else if (emptyStateNotes) {
            emptyStateNotes.style.display = 'none';
        }

        // Initialize doubts for each rendered note
        document.querySelectorAll('.inline-doubt-panel').forEach(panel => {
            const historyContainer = panel.querySelector('.inline-doubt-history');
            if (historyContainer) {
                const noteId = historyContainer.id.split('_')[1];
                loadDoubts(noteId, historyContainer);
            }
        });

        // Event Listeners for new buttons
        document.querySelectorAll('.view-pdf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.currentTarget.getAttribute('data-id');
                openPdfViewer(noteId);
            });
        });
        
        document.querySelectorAll('.attach-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.currentTarget.getAttribute('data-id');
                const fileInput = document.getElementById(`file_${noteId}`);
                if (fileInput) fileInput.click();
            });
        });

        document.querySelectorAll('input[type="file"]').forEach(input => {
            input.addEventListener('change', (e) => {
                const noteId = e.currentTarget.id.split('_')[1];
                const fileNameSpan = document.getElementById(`fileName_${noteId}`);
                if (e.target.files.length > 0 && fileNameSpan) {
                    fileNameSpan.textContent = e.target.files[0].name;
                }
            });
        });

        document.querySelectorAll('.send-doubt-inline').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.currentTarget.getAttribute('data-id');
                sendDoubt(noteId);
            });
        });

        document.querySelectorAll('.ai-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                alert('Gemini API Integration: Processing AI feature...');
            });
        });
    }

    function openPdfViewer(noteId) {
        if (!pdfViewerModal) return;
        let noteDetails = null;
        for (const notes of Object.values(mockNotesDB)) {
            const found = notes.find(n => n.id === noteId);
            if (found) {
                noteDetails = found;
                break;
            }
        }

        if (noteDetails) {
            if (pdfViewerTitle) pdfViewerTitle.textContent = `Chapter ${noteDetails.chapterNumber} — ${noteDetails.chapterName}`;
            if (pdfViewerMeta) pdfViewerMeta.textContent = `Uploaded by ${noteDetails.mentorName} • ${noteDetails.uploadDate}`;
            if (mockPdfTitle) mockPdfTitle.textContent = noteDetails.chapterName;
            
            pdfViewerModal.style.display = 'flex';
            setTimeout(() => {
                pdfViewerModal.classList.add('active');
            }, 10);
        }
    }

    function closePdfViewer() {
        if (!pdfViewerModal) return;
        pdfViewerModal.classList.remove('active');
        setTimeout(() => {
            pdfViewerModal.style.display = 'none';
        }, 300);
    }

    if (closePdfBtn) {
        closePdfBtn.addEventListener('click', closePdfViewer);
    }

    async function sendDoubt(noteId) {
        const inputEl = document.getElementById(`input_${noteId}`);
        const fileInputEl = document.getElementById(`file_${noteId}`);
        const historyContainer = document.getElementById(`history_${noteId}`);
        if (!inputEl || !historyContainer) return;

        const text = inputEl.value.trim();
        const file = fileInputEl ? fileInputEl.files[0] : null;
        
        if (text || file) {
            const timestamp = new Date().getTime();
            
            // Get Student Info
            const currentUserEmail = localStorage.getItem('currentUser') || 'student@edubridge.com';
            const studentName = currentUserEmail.split('@')[0];
            
            // Get Note Info
            let subject = "General";
            let chapter = "General";
            let mentorName = "Default Mentor";
            for (const subj of Object.keys(mockNotesDB)) {
                const found = mockNotesDB[subj].find(n => n.id === noteId);
                if (found) {
                    subject = subj;
                    chapter = found.chapterName;
                    mentorName = found.mentorName;
                    break;
                }
            }

            // Using mentorName as mentorId for matching, or a fixed ID if needed.
            const mentorId = "mentor@edubridge.com"; // Default for mockup matching

            try {
                // Change send button to show loading
                const btn = inputEl.nextElementSibling.querySelector('.send-doubt-inline');
                const originalContent = btn.innerHTML;
                btn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Sending...</span>';

                if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                    throw new Error("Firebase not configured");
                }

                let screenshotUrl = "";

                // Handle file upload to Firebase Storage
                if (file) {
                    btn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Uploading...</span>';
                    const storageRef = ref(storage, `doubts/${timestamp}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    screenshotUrl = await getDownloadURL(snapshot.ref);
                }

                const doubtData = {
                    doubtId: 'db_' + timestamp,
                    studentId: currentUserEmail,
                    studentName: studentName,
                    mentorId: mentorId, 
                    subject: subject,
                    chapterName: chapter,
                    doubtMessage: text,
                    screenshotUrl: screenshotUrl,
                    timestamp: serverTimestamp(),
                    status: "Unresolved"
                };

                // Save to Firestore
                await addDoc(collection(db, "doubts"), doubtData);
                
                // Remove the manual append and let the onSnapshot listener handle rendering
                inputEl.value = '';
                if (fileInputEl) fileInputEl.value = '';
                const fileNameSpan = document.getElementById(`fileName_${noteId}`);
                if (fileNameSpan) fileNameSpan.textContent = 'Attach Screenshot';
                
                // Restore button and show success
                btn.innerHTML = '<span><i class="fa-solid fa-check"></i> Sent!</span>';
                btn.style.background = 'var(--success)';
                
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.style.background = '';
                }, 2000);

            } catch (error) {
                console.log("Using localStorage fallback due to: ", error.message);
                
                let doubts = [];
                try {
                    const stored = localStorage.getItem(`doubts_${noteId}`);
                    if (stored) doubts = JSON.parse(stored);
                } catch(e) {}
                doubts.push({
                    text: text,
                    sender: 'student',
                    timestamp: timestamp
                });
                localStorage.setItem(`doubts_${noteId}`, JSON.stringify(doubts));
                
                // Update UI for fallback
                loadDoubts(noteId, historyContainer);
                
                inputEl.value = '';
                if (fileInputEl) fileInputEl.value = '';
                const fileNameSpan = document.getElementById(`fileName_${noteId}`);
                if (fileNameSpan) fileNameSpan.textContent = 'Attach Screenshot';
                
                const btn = inputEl.nextElementSibling.querySelector('.send-doubt-inline');
                btn.innerHTML = '<span><i class="fa-solid fa-check"></i> Sent!</span>';
                btn.style.background = 'var(--success)';
                
                setTimeout(() => {
                    btn.innerHTML = '<span><i class="fa-solid fa-paper-plane"></i> Send to Mentor</span>';
                    btn.style.background = '';
                }, 2000);
            }
        }
    }

    // Filters and Search
    if (subjectFilter) {
        subjectFilter.addEventListener('change', (e) => {
            renderNotes(e.target.value, notesSearch ? notesSearch.value : '');
        });
    }

    if (notesSearch) {
        notesSearch.addEventListener('input', (e) => {
            renderNotes(subjectFilter ? subjectFilter.value : 'all', e.target.value);
        });
    }

    // Initial Render
    renderNotes();
});

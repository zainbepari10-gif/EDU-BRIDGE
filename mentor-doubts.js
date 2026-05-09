import { db, storage } from './firebase-config.js';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {
    // ---- AUTHENTICATION CHECK ----
    const currentUserEmail = localStorage.getItem('currentUser');
    const currentRole = localStorage.getItem('currentRole');

    if (!currentUserEmail || currentRole !== 'mentor') {
        window.location.href = 'index.html'; // Redirect to login if not authenticated as mentor
        return;
    }

    let mentorData = JSON.parse(localStorage.getItem(`user_${currentUserEmail}`));
    if (!mentorData) {
        mentorData = {
            name: currentUserEmail.split('@')[0],
            role: 'mentor'
        };
    }

    const userNameEl = document.getElementById('userName');
    if (userNameEl) userNameEl.textContent = `Prof. ${mentorData.name}`;

    const userAvatarEl = document.getElementById('userAvatar');
    if (userAvatarEl) userAvatarEl.src = `https://ui-avatars.com/api/?name=${mentorData.name}&background=00e1ff&color=fff`;

    // ---- MOCK DB FOR NOTE ID LOOKUP ----
    const mockNotesDB = {
        "math_ch1": { subject: "Mathematics", chapter: "Matrices" },
        "phy_ch3": { subject: "Physics", chapter: "Modern Physics" },
        "chem_ch5": { subject: "Chemistry", chapter: "Chemical Bonding" },
        "cs_ch2": { subject: "Computer Science", chapter: "Data Structures" }
    };

    // Elements
    const doubtsGrid = document.getElementById('doubtsGrid');
    const emptyStateDoubts = document.getElementById('emptyStateDoubts');
    const doubtsFilter = document.getElementById('doubtsFilter');
    const doubtsSearch = document.getElementById('doubtsSearch');

    // Reply Modal Elements
    const replyDoubtModal = document.getElementById('replyDoubtModal');
    const closeReplyBtn = document.getElementById('closeReplyBtn');
    const cancelReplyBtn = document.getElementById('cancelReplyBtn');
    const sendReplyBtn = document.getElementById('sendReplyBtn');
    const replyTextarea = document.getElementById('replyTextarea');
    const replyDoubtMeta = document.getElementById('replyDoubtMeta');
    const replyDoubtText = document.getElementById('replyDoubtText');
    let currentReplyContext = null;

    let allDoubtsData = [];

    function renderDoubts(filterStatus = 'all', searchQuery = '') {
        if (!doubtsGrid) return;
        doubtsGrid.innerHTML = '';
        let count = 0;

        allDoubtsData.forEach(doubt => {
            // Apply Filters
            if (filterStatus !== 'all' && doubt.status !== filterStatus) {
                // If filter is 'pending', let's include 'high' priority as well
                if (!(filterStatus === 'pending' && doubt.status === 'high')) {
                    return;
                }
            }

            const searchStr = `${doubt.studentName} ${doubt.subject} ${doubt.chapterName} ${doubt.doubtMessage}`.toLowerCase();
            if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) {
                return;
            }

            count++;
            
            const card = document.createElement('div');
            card.className = 'doubt-card';

            const timeStr = doubt.timestamp && doubt.timestamp.toDate ? 
                doubt.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            let statusBadge = '';
            // For hackathon sake, Unresolved = pending
            if (doubt.status === 'Unresolved' || doubt.status === 'pending') {
                statusBadge = `<span class="status-badge status-yellow">Pending</span>`;
            } else if (doubt.status === 'high') {
                statusBadge = `<span class="status-badge status-red">High Priority</span>`;
            } else {
                statusBadge = `<span class="status-badge status-green">Resolved</span>`;
            }

            card.innerHTML = `
                <div class="doubt-header">
                    <div class="doubt-student-info">
                        <img src="https://ui-avatars.com/api/?name=${doubt.studentName}&background=random" alt="${doubt.studentName}">
                        <div class="doubt-meta">
                            <h4>${doubt.studentName}</h4>
                            <p><i class="fa-solid fa-book"></i> ${doubt.subject} • ${doubt.chapterName}</p>
                        </div>
                    </div>
                    <div class="doubt-time">${timeStr}</div>
                </div>
                <div class="doubt-body">
                    <div class="doubt-text">"${doubt.doubtMessage}"</div>
                    ${doubt.screenshotUrl ? `<div class="doubt-attachment"><i class="fa-solid fa-image"></i> Screenshot Attached</div>` : ''}
                </div>
                <div class="doubt-footer">
                    <div>${statusBadge}</div>
                    <button class="btn-small glow reply-btn" data-id="${doubt.id}" data-student="${doubt.studentName}" data-chapter="${doubt.chapterName}" data-text="${doubt.doubtMessage}">
                        ${doubt.status === 'Resolved' ? '<i class="fa-solid fa-eye"></i> View Thread' : '<i class="fa-solid fa-reply"></i> Reply'}
                    </button>
                </div>
            `;
            doubtsGrid.appendChild(card);
        });

        if (count === 0 && emptyStateDoubts) {
            emptyStateDoubts.style.display = 'flex';
        } else if (emptyStateDoubts) {
            emptyStateDoubts.style.display = 'none';
        }

        // Attach Reply Listeners
        document.querySelectorAll('.reply-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const b = e.currentTarget;
                openReplyModal(b.getAttribute('data-id'), b.getAttribute('data-student'), b.getAttribute('data-chapter'), b.getAttribute('data-text'));
            });
        });
    }

    function loadLocalDoubts() {
        let allDoubts = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('doubts_')) {
                try {
                    const noteId = key.replace('doubts_', '');
                    const stored = JSON.parse(localStorage.getItem(key));
                    
                    if (Array.isArray(stored) && stored.length > 0) {
                        let studentDoubts = stored.filter(d => d.sender === 'student' || !d.sender); // Support old or new structure
                        if (studentDoubts.length > 0) {
                            const latestStudentMsg = studentDoubts[studentDoubts.length - 1];
                            const lastMsg = stored[stored.length - 1];
                            // Status check supports new flat structure where the object has a mentorReply field, or old array structure
                            let status = 'pending';
                            if (latestStudentMsg.status === 'Resolved' || lastMsg.sender === 'mentor' || stored[0].mentorReply) {
                                status = 'resolved';
                            }
                            
                            let subject = "General Subject";
                            let chapter = "General Chapter";
                            if (mockNotesDB[noteId]) {
                                subject = mockNotesDB[noteId].subject;
                                chapter = mockNotesDB[noteId].chapter;
                            }

                            let studentName = "Aarav Sharma"; // Default Mock
                            
                            const doubtMsgText = latestStudentMsg.text || stored[0].doubtMessage;
                            const timestamp = stored[0].timestamp || latestStudentMsg.timestamp;

                            allDoubts.push({
                                id: noteId, // Use noteId as id for local fallback
                                studentName: studentName,
                                subject: subject,
                                chapterName: chapter,
                                doubtMessage: doubtMsgText,
                                timestamp: timestamp,
                                status: status
                            });
                        }
                    }
                } catch (e) {
                    console.error("Error parsing doubt", e);
                }
            }
        }
        
        allDoubts.sort((a, b) => b.timestamp - a.timestamp);
        return allDoubts;
    }

    function setupDoubtsListener() {
        try {
            if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                throw new Error("Firebase not configured");
            }
            
            const mentorId = "mentor@edubridge.com"; // Current mentor
            const q = query(collection(db, "doubts"), where("mentorId", "==", mentorId));

            onSnapshot(q, (snapshot) => {
                allDoubtsData = [];
                snapshot.forEach((doc) => {
                    allDoubtsData.push({ id: doc.id, ...doc.data() });
                });
                // Sort by timestamp descending
                allDoubtsData.sort((a, b) => {
                    const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : a.timestamp) : 0;
                    const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : b.timestamp) : 0;
                    return timeB - timeA;
                });
                renderDoubts(doubtsFilter ? doubtsFilter.value : 'all', doubtsSearch ? doubtsSearch.value : '');
            }, (error) => {
                throw error;
            });
        } catch (error) {
            console.log("Using localStorage fallback for Mentor Doubts list: ", error.message);
            
            const updateFromLocal = () => {
                allDoubtsData = loadLocalDoubts();
                renderDoubts(doubtsFilter ? doubtsFilter.value : 'all', doubtsSearch ? doubtsSearch.value : '');
            };
            
            updateFromLocal();
            
            // Listen for storage events (Real-time updates across tabs)
            window.addEventListener('storage', (e) => {
                if (e.key && e.key.startsWith('doubts_')) {
                    updateFromLocal();
                }
            });
        }
    }

    function openReplyModal(noteId, studentName, chapter, text) {
        currentReplyContext = noteId;
        replyDoubtMeta.textContent = `${studentName} • ${chapter}`;
        replyDoubtText.textContent = `"${text}"`;
        replyTextarea.value = '';
        
        replyDoubtModal.style.display = 'flex';
        setTimeout(() => {
            replyDoubtModal.classList.add('active');
            replyTextarea.focus();
        }, 10);
    }

    function closeReplyModal() {
        replyDoubtModal.classList.remove('active');
        setTimeout(() => {
            replyDoubtModal.style.display = 'none';
            currentReplyContext = null;
        }, 300);
    }

    // Modal Events
    if (closeReplyBtn) closeReplyBtn.addEventListener('click', closeReplyModal);
    if (cancelReplyBtn) cancelReplyBtn.addEventListener('click', closeReplyModal);
    
    const replyFileInput = document.getElementById('replyFileInput');

    if (sendReplyBtn) {
        sendReplyBtn.addEventListener('click', async () => {
            const replyText = replyTextarea.value.trim();
            const file = replyFileInput ? replyFileInput.files[0] : null;

            if ((replyText || file) && currentReplyContext) {
                
                const timestamp = new Date().getTime();

                try {
                    // Show loading on button
                    const originalBtnContent = sendReplyBtn.innerHTML;
                    sendReplyBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Sending...</span>';

                    if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                        throw new Error("Firebase not configured");
                    }

                    let explanationPdfUrl = "";

                    if (file) {
                        const storageRef = ref(storage, `explanations/${timestamp}_${file.name}`);
                        const snapshot = await uploadBytes(storageRef, file);
                        explanationPdfUrl = await getDownloadURL(snapshot.ref);
                    }
                    
                    const doubtDocRef = doc(db, "doubts", currentReplyContext);
                    await updateDoc(doubtDocRef, {
                        status: "Resolved",
                        mentorReply: replyText,
                        mentorReplyTimestamp: new Date(),
                        explanationPdfUrl: explanationPdfUrl
                    });

                    sendReplyBtn.innerHTML = originalBtnContent;
                } catch (error) {
                    console.log("Using localStorage fallback for Mentor Reply due to: ", error.message);
                    
                    // currentReplyContext serves as noteId in fallback
                    let doubts = [];
                    try {
                        const stored = localStorage.getItem(`doubts_${currentReplyContext}`);
                        if (stored) doubts = JSON.parse(stored);
                    } catch(e) {}

                    // We just mutate the first item in the array to hold the reply data to support the new UI
                    if (doubts.length > 0) {
                        doubts[0].status = "Resolved";
                        doubts[0].mentorReply = replyText;
                        doubts[0].mentorReplyTimestamp = timestamp;
                        // local fallback doesn't actually upload file, just a mock string
                        doubts[0].explanationPdfUrl = file ? "mock_local_file_url" : "";
                    } else {
                        doubts.push({
                            text: replyText,
                            sender: 'mentor',
                            timestamp: timestamp
                        });
                    }
                    
                    localStorage.setItem(`doubts_${currentReplyContext}`, JSON.stringify(doubts));
                    
                    window.dispatchEvent(new Event('storage'));
                    
                    allDoubtsData = loadLocalDoubts();
                    renderDoubts(doubtsFilter ? doubtsFilter.value : 'all', doubtsSearch ? doubtsSearch.value : '');

                    const sendBtn = document.getElementById('sendReplyBtn');
                    if (sendBtn) sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Reply';
                }
            }
            
            if (replyFileInput) replyFileInput.value = '';
            closeReplyModal();
        });
    }

    // Filter and Search Events
    if (doubtsFilter) {
        doubtsFilter.addEventListener('change', (e) => {
            renderDoubts(e.target.value, doubtsSearch ? doubtsSearch.value : '');
        });
    }

    if (doubtsSearch) {
        doubtsSearch.addEventListener('input', (e) => {
            renderDoubts(doubtsFilter ? doubtsFilter.value : 'all', e.target.value);
        });
    }

    // Initial setup
    setupDoubtsListener();

    // Logout
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

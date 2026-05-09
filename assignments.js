import { db, storage } from './firebase-config.js';
import { collection, query, onSnapshot, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {
    // ---- AUTHENTICATION CHECK ----
    const currentUserEmail = localStorage.getItem('currentUser');
    if (!currentUserEmail) {
        window.location.href = 'index.html';
        return;
    }

    const userData = JSON.parse(localStorage.getItem(`user_${currentUserEmail}`));
    if (userData) {
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            avatarEl.src = `https://ui-avatars.com/api/?name=${userData.name}&background=9d00ff&color=fff`;
        }
        const nameEl = document.getElementById('studentName');
        if (nameEl) nameEl.textContent = userData.name;
    }

    // State
    let assignments = [];
    const submissions = JSON.parse(localStorage.getItem(`submissions_${currentUserEmail}`)) || {};
    let currentFilter = 'all';
    let currentSearch = '';
    let selectedAssignmentId = null;

    // Elements
    const gridEl = document.getElementById('studentAssignmentsGrid') || document.getElementById('assignmentsGrid');
    const emptyStateEl = document.getElementById('emptyStateStudentAssignments') || document.getElementById('emptyStateAssignments');
    const filterEl = document.getElementById('studentAssignmentFilter') || document.getElementById('assignmentFilter');
    const searchEl = document.getElementById('studentAssignmentsSearch') || document.getElementById('assignmentSearch');

    // Views
    const listView = document.getElementById('assignmentsListView') || document.querySelector('.dashboard-scrollable > .doubts-grid').parentElement;
    const detailsView = document.getElementById('assignmentDetailsView');
    const backBtn = document.getElementById('backToAssignmentsBtn');

    // Details Elements
    const dTitle = document.getElementById('detailTitle');
    const dSubject = document.getElementById('detailSubject');
    const dMentor = document.getElementById('detailMentor');
    const dDueDate = document.getElementById('detailDueDate');
    const dTimeRemaining = document.getElementById('detailTimeRemaining');
    const dStatusBadge = document.getElementById('detailStatusBadge');
    const dDescription = document.getElementById('detailDescription');
    const dResources = document.getElementById('detailResources');
    const deadlineBox = document.getElementById('deadlineBox');

    // Submission Elements
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');
    const previewFileName = document.getElementById('previewFileName');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const submitBtn = document.getElementById('submitAssignmentBtn');
    const submissionPanel = document.getElementById('submissionPanel');
    const successPanel = document.getElementById('submissionSuccessPanel');
    const submissionTimestamp = document.getElementById('submissionTimestamp');
    const undoBtn = document.getElementById('undoSubmissionBtn');

    let selectedFile = null;

    // ---- LOAD DATA LOGIC ----
    function loadLocalAssignments() {
        let allAss = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('mentor_assignments_')) {
                try {
                    const mentorAss = JSON.parse(localStorage.getItem(key));
                    allAss = allAss.concat(mentorAss);
                } catch(e) {}
            }
        }
        return allAss.sort((a, b) => b.createdAt - a.createdAt);
    }

    function setupAssignmentsListener() {
        try {
            if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                throw new Error("Firebase not configured");
            }
            
            const q = query(collection(db, "assignments"));

            onSnapshot(q, (snapshot) => {
                assignments = [];
                snapshot.forEach((doc) => {
                    assignments.push({ id: doc.id, ...doc.data() });
                });
                assignments.sort((a, b) => b.createdAt - a.createdAt);
                renderGrid();
            }, (error) => {
                console.log("Firebase listener error (Student), falling back to local:", error.message);
                const updateFromLocal = () => {
                    assignments = loadLocalAssignments();
                    renderGrid();
                };
                updateFromLocal();
                window.addEventListener('storage', (e) => {
                    if ((e.key && e.key.startsWith('mentor_assignments_')) || !e.key) {
                        updateFromLocal();
                    }
                });
            });
        } catch (error) {
            console.log("Using localStorage fallback for Student Assignments list:", error.message);
            const updateFromLocal = () => {
                assignments = loadLocalAssignments();
                renderGrid();
            };
            
            updateFromLocal();
            
            window.addEventListener('storage', (e) => {
                if (e.key && e.key.startsWith('mentor_assignments_') || !e.key) {
                    updateFromLocal();
                }
            });
        }
    }

    // ---- RENDER LOGIC ----

    function getStatusInfo(assignment) {
        const sub = submissions[assignment.id];
        if (sub) {
            return { status: 'submitted', label: 'Submitted', class: 'status-green' };
        }
        const now = new Date().getTime();
        if (now > assignment.deadline) {
            return { status: 'overdue', label: 'Overdue', class: 'status-red' };
        }
        return { status: 'pending', label: 'Pending', class: 'status-yellow' };
    }

    function formatTimeRemaining(deadlineTimestamp) {
        const now = new Date().getTime();
        const diffMs = deadlineTimestamp - now;

        if (diffMs < 0) return 'Deadline passed';

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `${days}d ${hours}h left`;
        if (hours > 0) return `${hours} hours left`;
        return 'Less than an hour left';
    }

    function renderGrid() {
        if (!gridEl) return;
        
        // Remove existing cards
        const existingCards = gridEl.querySelectorAll('.assignment-card, .doubt-card');
        existingCards.forEach(c => c.remove());
        
        const filtered = assignments.filter(a => {
            const statusInfo = getStatusInfo(a);
            const matchesFilter = currentFilter === 'all' || statusInfo.status === currentFilter.toLowerCase();
            const searchLower = currentSearch.toLowerCase();
            const titleSafe = a.title ? a.title.toLowerCase() : '';
            const subjectSafe = a.subject ? a.subject.toLowerCase() : '';
            const matchesSearch = titleSafe.includes(searchLower) || subjectSafe.includes(searchLower);
            return matchesFilter && matchesSearch;
        });

        if (filtered.length === 0) {
            if (emptyStateEl) emptyStateEl.style.display = 'flex';
        } else {
            if (emptyStateEl) emptyStateEl.style.display = 'none';

            filtered.forEach(a => {
                const statusInfo = getStatusInfo(a);
                const hasAttachment = !!a.pdfUrl;
                const timeStr = formatTimeRemaining(a.deadline);
                const isOverdue = statusInfo.status === 'overdue';

                const card = document.createElement('div');
                card.className = `doubt-card ${isOverdue ? 'overdue-glow' : ''}`;
                card.style.borderLeft = `4px solid ${isOverdue ? 'var(--danger)' : (statusInfo.status === 'submitted' ? 'var(--success)' : 'var(--primary-purple)')}`;
                
                const deadlineDate = new Date(a.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                const deadlineTime = new Date(a.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                card.innerHTML = `
                    <div class="doubt-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 15px;">
                        <div>
                            <h4 style="font-size: 1.1rem; color: var(--primary-blue); margin-bottom: 5px;">${a.title}</h4>
                            <p style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-book"></i> Subject: ${a.subject}</p>
                        </div>
                        <div class="status-badge ${statusInfo.class}">${statusInfo.label}</div>
                    </div>
                    <div class="doubt-body" style="margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <div>
                                <span style="color: var(--text-muted); display: block; font-size: 0.8rem; margin-bottom: 3px;">Deadline:</span>
                                <span style="color: ${isOverdue ? 'var(--danger)' : 'var(--primary-purple)'}; font-weight: 600; font-size: 0.9rem;">${deadlineDate} • ${deadlineTime}</span>
                            </div>
                            <div class="time-left ${isOverdue ? 'text-danger' : 'glow-text'}" style="font-size: 0.85rem; font-weight: 600;">
                                <i class="fa-regular fa-clock"></i> ${timeStr}
                            </div>
                        </div>
                        ${hasAttachment ? `
                        <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                            <span style="color: var(--text-main); font-size: 0.85rem;"><i class="fa-solid fa-file-pdf" style="color: #ff4d4d;"></i> ${a.fileName || "document.pdf"}</span>
                            <button class="icon-btn download-attachment" data-url="${a.pdfUrl}" style="color: var(--primary-blue);"><i class="fa-solid fa-download"></i></button>
                        </div>` : ''}
                    </div>
                    <div class="doubt-footer" style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                        <button class="btn-small glow view-assignment-btn" data-id="${a.id}">
                            <i class="fa-solid fa-cloud-arrow-up"></i> ${statusInfo.status === 'submitted' ? 'View Submission' : 'Submit Now'}
                        </button>
                    </div>
                `;
                
                gridEl.appendChild(card);

                // Add listeners directly to the buttons inside this card
                const viewBtn = card.querySelector('.view-assignment-btn');
                if (viewBtn) {
                    viewBtn.addEventListener('click', () => openDetails(a));
                }

                const dlBtn = card.querySelector('.download-attachment');
                if (dlBtn) {
                    dlBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const url = dlBtn.getAttribute('data-url');
                        if (url && url !== "mock_url" && url !== "#") {
                            window.open(url, '_blank');
                        } else {
                            alert(`Mock Download: ${a.fileName}`);
                        }
                    });
                }
            });
        }
    }

    // ---- DETAILS VIEW LOGIC ----
    function openDetails(assignment) {
        if (!detailsView) {
            // Fallback if the details view HTML isn't set up yet
            alert("Open details for: " + assignment.title);
            return;
        }

        selectedAssignmentId = assignment.id;
        
        if (dTitle) dTitle.textContent = assignment.title;
        if (dSubject) dSubject.textContent = assignment.subject;
        if (dMentor) dMentor.textContent = assignment.mentorId || "Mentor";
        
        const deadlineDate = new Date(assignment.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const deadlineTime = new Date(assignment.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (dDueDate) dDueDate.textContent = `${deadlineDate} • ${deadlineTime}`;
        if (dTimeRemaining) dTimeRemaining.textContent = formatTimeRemaining(assignment.deadline);
        if (dDescription) dDescription.innerHTML = `<p>${assignment.description}</p>`;

        const statusInfo = getStatusInfo(assignment);
        if (dStatusBadge) {
            dStatusBadge.textContent = statusInfo.label;
            dStatusBadge.className = `details-status-badge ${statusInfo.class}`;
        }

        if (deadlineBox && dTimeRemaining) {
            if (statusInfo.status === 'overdue') {
                deadlineBox.classList.add('overdue');
                dTimeRemaining.classList.remove('glow-text');
                dTimeRemaining.classList.add('text-danger');
            } else {
                deadlineBox.classList.remove('overdue');
                dTimeRemaining.classList.add('glow-text');
                dTimeRemaining.classList.remove('text-danger');
            }
        }

        if (dResources) {
            dResources.innerHTML = '';
            if (assignment.pdfUrl) {
                const div = document.createElement('div');
                div.className = 'resource-item glass-panel';
                div.innerHTML = `
                    <div class="res-icon"><i class="fa-solid fa-file-pdf"></i></div>
                    <div class="res-info">
                        <h4>${assignment.fileName || "assignment.pdf"}</h4>
                    </div>
                    <button class="btn-small outline download-btn"><i class="fa-solid fa-download"></i></button>
                `;
                div.querySelector('.download-btn').addEventListener('click', () => {
                    if (assignment.pdfUrl !== "mock_url" && assignment.pdfUrl !== "#") {
                        window.open(assignment.pdfUrl, '_blank');
                    } else {
                        alert("Mock Download");
                    }
                });
                dResources.appendChild(div);
            } else {
                dResources.innerHTML = '<p class="text-muted">No resources attached.</p>';
            }
        }

        resetSubmissionPanel();
        if (statusInfo.status === 'submitted') {
            showSuccessPanel(submissions[assignment.id]);
        } else {
            showUploadPanel();
        }

        const listContainer = document.getElementById('assignmentsListView') || document.getElementById('studentAssignmentsGrid').parentElement;
        listContainer.style.display = 'none';
        detailsView.style.display = 'block';
        window.scrollTo(0, 0);
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            detailsView.style.display = 'none';
            const listContainer = document.getElementById('assignmentsListView') || document.getElementById('studentAssignmentsGrid').parentElement;
            listContainer.style.display = 'block';
            renderGrid();
        });
    }

    // ---- SUBMISSION LOGIC ----
    function resetSubmissionPanel() {
        if (!uploadZone) return;
        selectedFile = null;
        if (fileInput) fileInput.value = '';
        if (filePreview) filePreview.style.display = 'none';
        uploadZone.style.display = 'block';
        if (submitBtn) submitBtn.disabled = true;
    }

    function showUploadPanel() {
        if (submissionPanel) submissionPanel.style.display = 'block';
        if (successPanel) successPanel.style.display = 'none';
    }

    function showSuccessPanel(subData) {
        if (submissionPanel) submissionPanel.style.display = 'none';
        if (successPanel) successPanel.style.display = 'flex';
        if (submissionTimestamp) submissionTimestamp.textContent = new Date(subData.timestamp).toLocaleString();
    }

    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
        });
    }

    function handleFileSelect(file) {
        selectedFile = file;
        if (previewFileName) previewFileName.textContent = file.name;
        if (uploadZone) uploadZone.style.display = 'none';
        if (filePreview) filePreview.style.display = 'flex';
        if (submitBtn) submitBtn.disabled = false;
    }

    if (removeFileBtn) removeFileBtn.addEventListener('click', resetSubmissionPanel);

    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!selectedFile || !selectedAssignmentId) return;

            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Uploading...</span><div class="btn-glow"></div>';
            submitBtn.disabled = true;

            const subData = {
                timestamp: new Date().getTime(),
                fileName: selectedFile.name
            };

            try {
                if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                    throw new Error("Firebase not configured");
                }
                // Upload file to Firebase storage
                const storageRef = ref(storage, `submissions/${selectedAssignmentId}_${currentUserEmail}_${selectedFile.name}`);
                await uploadBytes(storageRef, selectedFile);
                
                // Update assignment submissions count
                await updateDoc(doc(db, "assignments", selectedAssignmentId), {
                    totalSubmissions: increment(1)
                });
            } catch (error) {
                console.log("Using localStorage fallback for submission:", error.message);
                
                // Fallback update assignment submissions count
                let updated = false;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('mentor_assignments_')) {
                        let mentorAss = JSON.parse(localStorage.getItem(key));
                        const idx = mentorAss.findIndex(a => a.id === selectedAssignmentId);
                        if (idx !== -1) {
                            mentorAss[idx].totalSubmissions = (mentorAss[idx].totalSubmissions || 0) + 1;
                            localStorage.setItem(key, JSON.stringify(mentorAss));
                            updated = true;
                            break;
                        }
                    }
                }
                if (updated) window.dispatchEvent(new Event('storage'));
            }

            submissions[selectedAssignmentId] = subData;
            localStorage.setItem(`submissions_${currentUserEmail}`, JSON.stringify(submissions));
            
            if (dStatusBadge) {
                dStatusBadge.textContent = 'Submitted';
                dStatusBadge.className = 'details-status-badge status-green';
            }
            showSuccessPanel(subData);
            submitBtn.innerHTML = originalText;
            
            if (userData) {
                userData.tasksCompleted = (userData.tasksCompleted || 0) + 1;
                localStorage.setItem(`user_${currentUserEmail}`, JSON.stringify(userData));
            }
        });
    }

    if (undoBtn) {
        undoBtn.addEventListener('click', async () => {
            delete submissions[selectedAssignmentId];
            localStorage.setItem(`submissions_${currentUserEmail}`, JSON.stringify(submissions));
            
            try {
                if (db && db.app && db.app.options.apiKey !== "YOUR_API_KEY") {
                    await updateDoc(doc(db, "assignments", selectedAssignmentId), {
                        totalSubmissions: increment(-1)
                    });
                }
            } catch(e) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('mentor_assignments_')) {
                        let mentorAss = JSON.parse(localStorage.getItem(key));
                        const idx = mentorAss.findIndex(a => a.id === selectedAssignmentId);
                        if (idx !== -1 && mentorAss[idx].totalSubmissions > 0) {
                            mentorAss[idx].totalSubmissions--;
                            localStorage.setItem(key, JSON.stringify(mentorAss));
                            window.dispatchEvent(new Event('storage'));
                            break;
                        }
                    }
                }
            }

            const assignment = assignments.find(a => a.id === selectedAssignmentId);
            const statusInfo = getStatusInfo(assignment);
            
            if (dStatusBadge) {
                dStatusBadge.textContent = statusInfo.label;
                dStatusBadge.className = `details-status-badge ${statusInfo.class}`;
            }
            
            resetSubmissionPanel();
            showUploadPanel();

            if (userData && userData.tasksCompleted > 0) {
                userData.tasksCompleted--;
                localStorage.setItem(`user_${currentUserEmail}`, JSON.stringify(userData));
            }
        });
    }

    // ---- EVENT LISTENERS ----
    if (filterEl) {
        filterEl.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            renderGrid();
        });
    }

    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            renderGrid();
        });
    }

    // Init
    setupAssignmentsListener();
});

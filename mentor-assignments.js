import { db, storage } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {
    // ---- AUTHENTICATION CHECK ----
    const currentUserEmail = localStorage.getItem('currentUser');
    const currentRole = localStorage.getItem('currentRole');

    if (!currentUserEmail || currentRole !== 'mentor') {
        window.location.href = 'index.html';
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

    // Elements
    const assignmentsGrid = document.getElementById('assignmentsGrid');
    const emptyStateAssignments = document.getElementById('emptyStateAssignments');
    const assignmentFilter = document.getElementById('assignmentFilter');
    const assignmentsSearch = document.getElementById('assignmentsSearch');
    
    const createBtn = document.getElementById('createAssignmentBtn');
    const createPanel = document.getElementById('createAssignmentPanel');
    const closeCreateBtn = document.getElementById('closeCreateAssignmentBtn');
    const createForm = document.getElementById('createAssignmentForm');
    
    const uploadZone = document.getElementById('assignmentUploadZone');
    const fileInput = document.getElementById('assignmentFileInput');
    const fileNameDisplay = document.getElementById('assignmentFileName');

    let allAssignmentsData = [];

    // Fallback Mock Data
    const fallbackMockAssignments = [
        { 
            id: "mock_a1", 
            title: "Data Structures Report", 
            subject: "Computer Science", 
            description: "Write a comprehensive report on linked list operations and binary tree traversal.",
            pdfUrl: "assignment_ds.pdf",
            fileName: "assignment_ds.pdf",
            createdAt: new Date().getTime() - 86400000, 
            deadline: new Date().getTime() + 86400000 * 5, // 5 days from now
            status: "Active",
            totalSubmissions: 18,
            totalStudents: 32
        },
        { 
            id: "mock_a2", 
            title: "Quantum Mechanics Essay", 
            subject: "Physics", 
            description: "Discuss the implications of Schrödinger's cat thought experiment.",
            pdfUrl: "#",
            fileName: "physics_essay.pdf",
            createdAt: new Date().getTime() - 86400000 * 3, 
            deadline: new Date().getTime() - 86400000, // Overdue by 1 day
            status: "Overdue",
            totalSubmissions: 30,
            totalStudents: 32
        }
    ];

    function loadLocalAssignments() {
        let stored = localStorage.getItem(`mentor_assignments_${currentUserEmail}`);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch(e) {
                console.error("Error parsing local assignments", e);
            }
        }
        localStorage.setItem(`mentor_assignments_${currentUserEmail}`, JSON.stringify(fallbackMockAssignments));
        return fallbackMockAssignments;
    }

    function calculateStatus(deadlineTimestamp) {
        const now = new Date().getTime();
        if (now > deadlineTimestamp) {
            return "Overdue";
        }
        return "Active";
    }

    function renderAssignments(filterStatus = 'All', searchQuery = '') {
        if (!assignmentsGrid) return;
        assignmentsGrid.innerHTML = '';
        let count = 0;

        allAssignmentsData.forEach(assignment => {
            // Dynamically calculate status based on deadline
            const currentStatus = calculateStatus(assignment.deadline);
            
            // Apply Filters
            if (filterStatus !== 'All' && currentStatus !== filterStatus && assignment.status !== filterStatus) {
                return;
            }

            const searchStr = `${assignment.title} ${assignment.subject}`.toLowerCase();
            if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) {
                return;
            }

            count++;
            
            const card = document.createElement('div');
            card.className = 'doubt-card'; 
            card.style.borderLeft = `4px solid ${currentStatus === 'Overdue' ? 'var(--danger)' : 'var(--primary-purple)'}`;
            
            const createdDate = new Date(assignment.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const deadlineDate = new Date(assignment.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const deadlineTime = new Date(assignment.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const statusBadge = currentStatus === 'Active' 
                ? `<span class="status-badge status-green"><i class="fa-solid fa-clock"></i> Active</span>`
                : `<span class="status-badge status-red" style="color: #ff4d4d; background: rgba(255, 77, 77, 0.1);"><i class="fa-solid fa-triangle-exclamation"></i> Overdue</span>`;

            card.innerHTML = `
                <div class="doubt-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 15px;">
                    <div>
                        <h4 style="font-size: 1.1rem; color: var(--primary-blue); margin-bottom: 5px;">${assignment.title}</h4>
                        <p style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-solid fa-book"></i> Subject: ${assignment.subject}</p>
                    </div>
                    <div>${statusBadge}</div>
                </div>
                <div class="doubt-body" style="margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.85rem; margin-bottom: 15px;">
                        <div>
                            <span style="color: var(--text-muted); display: block; margin-bottom: 3px;">Created:</span>
                            <span style="color: var(--text-main);">${createdDate}</span>
                        </div>
                        <div>
                            <span style="color: var(--text-muted); display: block; margin-bottom: 3px;">Deadline:</span>
                            <span style="color: ${currentStatus === 'Overdue' ? 'var(--danger)' : 'var(--primary-purple)'}; font-weight: 600;">${deadlineDate} • ${deadlineTime}</span>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <span style="color: var(--text-muted); font-size: 0.8rem; display: block; margin-bottom: 3px;">Attached PDF:</span>
                            <span style="color: var(--text-main); font-size: 0.85rem;"><i class="fa-solid fa-file-pdf" style="color: #ff4d4d;"></i> ${assignment.fileName || "document.pdf"}</span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="color: var(--text-muted);"><i class="fa-solid fa-users"></i> Submissions:</span>
                        <span style="color: var(--success); font-weight: 700;">${assignment.totalSubmissions || 0} / ${assignment.totalStudents || 32} Students</span>
                    </div>
                </div>
                <div class="doubt-footer" style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    <button class="btn-small glow view-assignment-btn" data-id="${assignment.id}">
                        <i class="fa-solid fa-eye"></i> View Assignment
                    </button>
                    <button class="btn-small outline remove-assignment-btn" data-id="${assignment.id}" style="color: var(--danger); border-color: rgba(255, 51, 102, 0.3);">
                        <i class="fa-solid fa-trash-can"></i> Remove
                    </button>
                </div>
            `;
            assignmentsGrid.appendChild(card);
        });

        if (count === 0 && emptyStateAssignments) {
            emptyStateAssignments.style.display = 'flex';
        } else if (emptyStateAssignments) {
            emptyStateAssignments.style.display = 'none';
        }

        // Action Listeners
        document.querySelectorAll('.view-assignment-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const assignment = allAssignmentsData.find(a => a.id === id);
                if (assignment) {
                    openViewModal(assignment);
                }
            });
        });

        document.querySelectorAll('.remove-assignment-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("Remove this assignment? All related student submissions will be lost.")) {
                    const id = e.currentTarget.getAttribute('data-id');
                    const btnEl = e.currentTarget;
                    const originalContent = btnEl.innerHTML;
                    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                    try {
                        if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                            throw new Error("Firebase not configured");
                        }
                        await deleteDoc(doc(db, "assignments", id));
                        // Note: If using storage, delete Object logic goes here
                    } catch (error) {
                        console.log("Using localStorage fallback for delete:", error.message);
                        let local = loadLocalAssignments();
                        local = local.filter(a => a.id !== id);
                        localStorage.setItem(`mentor_assignments_${currentUserEmail}`, JSON.stringify(local));
                        allAssignmentsData = local;
                        renderAssignments(assignmentFilter ? assignmentFilter.value : 'All', assignmentsSearch ? assignmentsSearch.value : '');
                        
                        // Sync via storage event
                        window.dispatchEvent(new Event('storage'));
                    }
                }
            });
        });
    }

    function setupAssignmentsListener() {
        try {
            if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                throw new Error("Firebase not configured");
            }
            
            const mentorEmail = currentUserEmail || "mentor@edubridge.com";
            const q = query(collection(db, "assignments"), where("mentorId", "==", mentorEmail));

            onSnapshot(q, (snapshot) => {
                allAssignmentsData = [];
                snapshot.forEach((doc) => {
                    allAssignmentsData.push({ id: doc.id, ...doc.data() });
                });
                
                allAssignmentsData.sort((a, b) => b.createdAt - a.createdAt);
                
                renderAssignments(assignmentFilter ? assignmentFilter.value : 'All', assignmentsSearch ? assignmentsSearch.value : '');
            }, (error) => {
                console.log("Firebase listener error (Mentor), falling back to local:", error.message);
                const updateFromLocal = () => {
                    allAssignmentsData = loadLocalAssignments();
                    allAssignmentsData.sort((a, b) => b.createdAt - a.createdAt);
                    renderAssignments(assignmentFilter ? assignmentFilter.value : 'All', assignmentsSearch ? assignmentsSearch.value : '');
                };
                updateFromLocal();
                window.addEventListener('storage', (e) => {
                    if (e.key === `mentor_assignments_${currentUserEmail}` || !e.key) {
                        updateFromLocal();
                    }
                });
            });
        } catch (error) {
            console.log("Using localStorage fallback for Assignments list:", error.message);
            const updateFromLocal = () => {
                allAssignmentsData = loadLocalAssignments();
                allAssignmentsData.sort((a, b) => b.createdAt - a.createdAt);
                renderAssignments(assignmentFilter ? assignmentFilter.value : 'All', assignmentsSearch ? assignmentsSearch.value : '');
            };
            
            updateFromLocal();
            
            window.addEventListener('storage', (e) => {
                if (e.key === `mentor_assignments_${currentUserEmail}` || !e.key) {
                    updateFromLocal();
                }
            });
        }
    }

    // Toggle Create Panel
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            createPanel.style.display = createPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (closeCreateBtn) {
        closeCreateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            createPanel.style.display = 'none';
        });
    }

    // File Upload Zone
    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--primary-purple)';
            uploadZone.style.background = 'rgba(157, 78, 221, 0.1)';
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.style.borderColor = 'rgba(255,255,255,0.2)';
            uploadZone.style.background = 'transparent';
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.style.borderColor = 'rgba(255,255,255,0.2)';
            uploadZone.style.background = 'transparent';
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                fileNameDisplay.textContent = fileInput.files[0].name;
            }
        });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = fileInput.files[0].name;
            }
        });
    }

    // Handle Create Form
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const title = document.getElementById('assignmentTitle').value.trim();
            const subject = document.getElementById('assignmentSubject').value;
            const deadlineRaw = document.getElementById('assignmentDeadline').value;
            const description = document.getElementById('assignmentDescription').value.trim();
            const file = fileInput.files[0];

            if (!deadlineRaw) {
                alert("Please select a valid deadline.");
                return;
            }

            const submitBtn = createForm.querySelector('button[type="submit"]');
            const originalBtnContent = submitBtn.innerHTML;
            const timestamp = new Date().getTime();
            const deadlineTimestamp = new Date(deadlineRaw).getTime();
            
            try {
                submitBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Publishing...</span>';
                submitBtn.disabled = true;

                if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                    throw new Error("Firebase not configured");
                }

                let pdfUrl = "";
                let fileName = "";
                if (file) {
                    submitBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Uploading PDF...</span>';
                    const storageRef = ref(storage, `assignments/${timestamp}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    pdfUrl = await getDownloadURL(snapshot.ref);
                    fileName = file.name;
                }

                const assignmentData = {
                    mentorId: currentUserEmail || "mentor@edubridge.com",
                    title: title,
                    subject: subject,
                    description: description,
                    deadline: deadlineTimestamp,
                    createdAt: timestamp,
                    pdfUrl: pdfUrl,
                    fileName: fileName,
                    status: "Active",
                    totalSubmissions: 0,
                    totalStudents: 32
                };

                await addDoc(collection(db, "assignments"), assignmentData);
                
                submitBtn.innerHTML = '<span><i class="fa-solid fa-check"></i> Published!</span>';
                submitBtn.style.background = 'var(--success)';
                
            } catch (error) {
                console.log("Using localStorage fallback for Create Assignment:", error.message);
                
                let local = loadLocalAssignments();
                local.push({
                    id: "local_a_" + timestamp,
                    title: title,
                    subject: subject,
                    description: description,
                    deadline: deadlineTimestamp,
                    createdAt: timestamp,
                    pdfUrl: file ? "mock_url" : "",
                    fileName: file ? file.name : "",
                    status: "Active",
                    totalSubmissions: 0,
                    totalStudents: 32
                });
                localStorage.setItem(`mentor_assignments_${currentUserEmail}`, JSON.stringify(local));
                
                // Sync UI and broadcast event
                allAssignmentsData = local;
                renderAssignments(assignmentFilter ? assignmentFilter.value : 'All', assignmentsSearch ? assignmentsSearch.value : '');
                window.dispatchEvent(new Event('storage'));

                submitBtn.innerHTML = '<span><i class="fa-solid fa-check"></i> Published Locally!</span>';
                submitBtn.style.background = 'var(--success)';
            }

            setTimeout(() => {
                submitBtn.innerHTML = originalBtnContent;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
                createForm.reset();
                fileNameDisplay.textContent = "No file selected";
                createPanel.style.display = 'none';
            }, 1500);
        });
    }

    // View Assignment Modal Details
    const viewModal = document.getElementById('viewAssignmentModal');
    const viewBody = document.getElementById('viewBody');
    const closeViewBtn = document.getElementById('closeViewBtn');
    const viewTitle = document.getElementById('viewTitle');

    function openViewModal(assignment) {
        const currentStatus = calculateStatus(assignment.deadline);
        const deadlineDate = new Date(assignment.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        const deadlineTime = new Date(assignment.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        viewTitle.textContent = assignment.title;
        
        let statusBadge = currentStatus === 'Active' 
            ? `<span class="status-badge status-green"><i class="fa-solid fa-clock"></i> Active</span>`
            : `<span class="status-badge status-red" style="color: #ff4d4d; background: rgba(255, 77, 77, 0.1);"><i class="fa-solid fa-triangle-exclamation"></i> Overdue</span>`;

        viewBody.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <span style="color: var(--primary-purple); font-weight: 600;"><i class="fa-solid fa-book"></i> ${assignment.subject}</span>
                    ${statusBadge}
                </div>
                
                <h4 style="color: var(--text-main); margin-bottom: 10px;">Description</h4>
                <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; color: var(--text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 20px;">
                    ${assignment.description}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; text-align: center;">
                        <i class="fa-regular fa-clock" style="font-size: 1.5rem; color: ${currentStatus === 'Overdue' ? 'var(--danger)' : 'var(--primary-purple)'}; margin-bottom: 10px; display: block;"></i>
                        <span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Deadline</span>
                        <span style="color: var(--text-main); font-weight: 600; font-size: 0.95rem;">${deadlineDate} • ${deadlineTime}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; text-align: center;">
                        <i class="fa-solid fa-users" style="font-size: 1.5rem; color: var(--success); margin-bottom: 10px; display: block;"></i>
                        <span style="color: var(--text-muted); font-size: 0.8rem; display: block;">Submissions</span>
                        <span style="color: var(--text-main); font-weight: 600; font-size: 0.95rem;">${assignment.totalSubmissions || 0} / ${assignment.totalStudents || 32} Students</span>
                    </div>
                </div>

                ${assignment.fileName ? `
                    <div style="text-align: center; margin-bottom: 20px;">
                        <button class="btn-small outline" onclick="alert('Viewing PDF Document: ${assignment.fileName}')" style="width: 100%; border-color: var(--primary-blue); color: var(--primary-blue);">
                            <i class="fa-solid fa-file-pdf"></i> Download Attached PDF
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                <h4 style="color: var(--text-main); margin-bottom: 15px;">Recent Submissions</h4>
                <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; text-align: center;">
                    Detailed student submissions table will appear here.
                </div>
            </div>
        `;

        viewModal.style.display = 'flex';
        setTimeout(() => viewModal.classList.add('active'), 10);
    }

    if (closeViewBtn) {
        closeViewBtn.addEventListener('click', () => {
            viewModal.classList.remove('active');
            setTimeout(() => viewModal.style.display = 'none', 300);
        });
    }

    // Filters and Search
    if (assignmentFilter) {
        assignmentFilter.addEventListener('change', (e) => {
            renderAssignments(e.target.value, assignmentsSearch ? assignmentsSearch.value : '');
        });
    }

    if (assignmentsSearch) {
        assignmentsSearch.addEventListener('input', (e) => {
            renderAssignments(assignmentFilter ? assignmentFilter.value : 'All', e.target.value);
        });
    }

    // Init
    setupAssignmentsListener();

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

import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

    // Elements
    const studentsGrid = document.getElementById('studentsGrid');
    const emptyStateStudents = document.getElementById('emptyStateStudents');
    const studentFilter = document.getElementById('studentFilter');
    const studentsSearch = document.getElementById('studentsSearch');
    
    const addStudentBtn = document.getElementById('addStudentBtn');
    const addStudentPanel = document.getElementById('addStudentPanel');
    const closeAddStudentBtn = document.getElementById('closeAddStudentBtn');
    const addStudentForm = document.getElementById('addStudentForm');

    let allStudentsData = [];

    // Fallback Mock Data
    const fallbackMockStudents = [
        { id: "mock_s1", name: "Aarav Sharma", email: "aarav@edubridge.com", course: "Computer Science", productivity: 92, status: "Active" },
        { id: "mock_s2", name: "Priya Patel", email: "priya@edubridge.com", course: "Physics", productivity: 85, status: "Active" },
        { id: "mock_s3", name: "Rahul Verma", email: "rahul@edubridge.com", course: "Mathematics", productivity: 45, status: "Inactive" },
        { id: "mock_s4", name: "Sneha Iyer", email: "sneha@edubridge.com", course: "Chemistry", productivity: 78, status: "Active" }
    ];

    function loadLocalStudents() {
        let stored = localStorage.getItem(`mentor_students_${currentUserEmail}`);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch(e) {
                console.error("Error parsing local students", e);
            }
        }
        // Initialize with fallback if empty
        localStorage.setItem(`mentor_students_${currentUserEmail}`, JSON.stringify(fallbackMockStudents));
        return fallbackMockStudents;
    }

    function renderStudents(filterStatus = 'All', searchQuery = '') {
        if (!studentsGrid) return;
        studentsGrid.innerHTML = '';
        let count = 0;

        allStudentsData.forEach(student => {
            // Apply Filters
            if (filterStatus !== 'All' && student.status !== filterStatus) {
                return;
            }

            const searchStr = `${student.name} ${student.email} ${student.course}`.toLowerCase();
            if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) {
                return;
            }

            count++;
            
            const card = document.createElement('div');
            card.className = 'doubt-card'; // Reusing glassmorphism styling
            
            const isHighProd = student.productivity >= 80;
            const isMedProd = student.productivity >= 50 && student.productivity < 80;
            const prodColor = isHighProd ? 'var(--success)' : (isMedProd ? 'var(--warning)' : 'var(--danger)');
            
            const statusBadge = student.status === 'Active' 
                ? `<span class="status-badge status-green">Active</span>`
                : `<span class="status-badge status-red" style="color: #ff4d4d; background: rgba(255, 77, 77, 0.1);">Inactive</span>`;

            card.innerHTML = `
                <div class="doubt-header" style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 15px;">
                    <div class="doubt-student-info">
                        <img src="https://ui-avatars.com/api/?name=${student.name}&background=random" alt="${student.name}" style="width: 50px; height: 50px;">
                        <div class="doubt-meta">
                            <h4 style="font-size: 1.1rem;">${student.name}</h4>
                            <p style="font-size: 0.8rem; color: var(--text-muted);"><i class="fa-regular fa-envelope"></i> ${student.email}</p>
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>
                <div class="doubt-body" style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 0.9rem;">
                        <span style="color: var(--text-muted);"><i class="fa-solid fa-book-open"></i> Enrolled Course:</span>
                        <span style="color: var(--text-main); font-weight: 500;">${student.course}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem;">
                        <span style="color: var(--text-muted);"><i class="fa-solid fa-chart-line"></i> Productivity:</span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 100px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden;">
                                <div style="width: ${student.productivity}%; height: 100%; background: ${prodColor};"></div>
                            </div>
                            <span style="color: ${prodColor}; font-weight: 700;">${student.productivity}%</span>
                        </div>
                    </div>
                </div>
                <div class="doubt-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-small outline view-profile-btn" data-id="${student.id}">
                        <i class="fa-regular fa-id-card"></i> Profile
                    </button>
                    <button class="btn-small outline remove-student-btn" data-id="${student.id}" style="color: var(--danger); border-color: rgba(255, 51, 102, 0.3);">
                        <i class="fa-solid fa-user-minus"></i> Remove
                    </button>
                </div>
            `;
            studentsGrid.appendChild(card);
        });

        if (count === 0 && emptyStateStudents) {
            emptyStateStudents.style.display = 'flex';
        } else if (emptyStateStudents) {
            emptyStateStudents.style.display = 'none';
        }

        // Action Listeners
        document.querySelectorAll('.view-profile-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                alert('Detailed Student Profile view coming soon!');
            });
        });

        document.querySelectorAll('.remove-student-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("Are you sure you want to remove this student?")) {
                    const studentId = e.currentTarget.getAttribute('data-id');
                    const btnEl = e.currentTarget;
                    const originalContent = btnEl.innerHTML;
                    btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                    try {
                        if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                            throw new Error("Firebase not configured");
                        }
                        await deleteDoc(doc(db, "students", studentId));
                    } catch (error) {
                        console.log("Using localStorage fallback for delete:", error.message);
                        let localStudents = loadLocalStudents();
                        localStudents = localStudents.filter(s => s.id !== studentId);
                        localStorage.setItem(`mentor_students_${currentUserEmail}`, JSON.stringify(localStudents));
                        allStudentsData = localStudents;
                        renderStudents(studentFilter ? studentFilter.value : 'All', studentsSearch ? studentsSearch.value : '');
                    }
                }
            });
        });
    }

    function setupStudentsListener() {
        try {
            if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                throw new Error("Firebase not configured");
            }
            
            const mentorEmail = currentUserEmail || "mentor@edubridge.com";
            const q = query(collection(db, "students"), where("mentorEmail", "==", mentorEmail));

            onSnapshot(q, (snapshot) => {
                allStudentsData = [];
                snapshot.forEach((doc) => {
                    allStudentsData.push({ id: doc.id, ...doc.data() });
                });
                renderStudents(studentFilter ? studentFilter.value : 'All', studentsSearch ? studentsSearch.value : '');
            }, (error) => {
                throw error;
            });
        } catch (error) {
            console.log("Using localStorage fallback for Students list:", error.message);
            allStudentsData = loadLocalStudents();
            renderStudents(studentFilter ? studentFilter.value : 'All', studentsSearch ? studentsSearch.value : '');
        }
    }

    // Toggle Add Student Panel
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', () => {
            addStudentPanel.style.display = addStudentPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (closeAddStudentBtn) {
        closeAddStudentBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addStudentPanel.style.display = 'none';
        });
    }

    // Handle Add Student Submission
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('addStudentName').value.trim();
            const email = document.getElementById('addStudentEmail').value.trim();
            const course = document.getElementById('addStudentCourse').value;
            const status = document.getElementById('addStudentStatus').value;

            const submitBtn = addStudentForm.querySelector('button[type="submit"]');
            const originalBtnContent = submitBtn.innerHTML;
            
            try {
                submitBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Adding...</span>';
                submitBtn.disabled = true;

                const studentData = {
                    name: name,
                    email: email,
                    course: course,
                    status: status,
                    productivity: Math.floor(Math.random() * 41) + 60, // Random starting productivity 60-100
                    mentorEmail: currentUserEmail || "mentor@edubridge.com",
                    timestamp: serverTimestamp()
                };

                if (!db || !db.app || db.app.options.apiKey === "YOUR_API_KEY") {
                    throw new Error("Firebase not configured");
                }

                await addDoc(collection(db, "students"), studentData);
                
                // Success UI update
                submitBtn.innerHTML = '<span><i class="fa-solid fa-check"></i> Added!</span>';
                submitBtn.style.background = 'var(--success)';
                
            } catch (error) {
                console.log("Using localStorage fallback for Add Student:", error.message);
                
                let localStudents = loadLocalStudents();
                localStudents.push({
                    id: "local_" + new Date().getTime(),
                    name: name,
                    email: email,
                    course: course,
                    status: status,
                    productivity: Math.floor(Math.random() * 41) + 60
                });
                localStorage.setItem(`mentor_students_${currentUserEmail}`, JSON.stringify(localStudents));
                
                allStudentsData = localStudents;
                renderStudents(studentFilter ? studentFilter.value : 'All', studentsSearch ? studentsSearch.value : '');

                submitBtn.innerHTML = '<span><i class="fa-solid fa-check"></i> Added Locally!</span>';
                submitBtn.style.background = 'var(--success)';
            }

            setTimeout(() => {
                submitBtn.innerHTML = originalBtnContent;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
                addStudentForm.reset();
                addStudentPanel.style.display = 'none';
            }, 1500);
        });
    }

    // Filters and Search Events
    if (studentFilter) {
        studentFilter.addEventListener('change', (e) => {
            renderStudents(e.target.value, studentsSearch ? studentsSearch.value : '');
        });
    }

    if (studentsSearch) {
        studentsSearch.addEventListener('input', (e) => {
            renderStudents(studentFilter ? studentFilter.value : 'All', e.target.value);
        });
    }

    // Initial Render & Setup
    setupStudentsListener();

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

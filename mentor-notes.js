import { db, storage } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
    const notesGrid = document.getElementById('notesGrid');
    const emptyStateNotes = document.getElementById('emptyStateNotes');
    const subjectFilter = document.getElementById('subjectFilter');
    const notesSearch = document.getElementById('notesSearch');
    
    const uploadNotesBtn = document.getElementById('uploadNotesBtn');
    const uploadPanel = document.getElementById('uploadPanel');
    const closeUploadBtn = document.getElementById('closeUploadBtn');
    const uploadForm = document.getElementById('uploadForm');
    const browseFilesText = document.getElementById('browseFilesText');
    const pdfFileInput = document.getElementById('pdfFileInput');
    const selectedFileName = document.getElementById('selectedFileName');
    const dragDropZone = document.getElementById('dragDropZone');

    let allNotesData = [];

    // Fallback Mock Data if Firebase is not connected
    const fallbackMockNotes = [
        { id: "mock_1", subject: "Computer Science", chapterName: "Data Structures", uploadDate: "14 May 2026", pdfSize: "4.2 MB", pdfUrl: "#" },
        { id: "mock_2", subject: "Physics", chapterName: "Modern Physics", uploadDate: "12 May 2026", pdfSize: "3.1 MB", pdfUrl: "#" },
        { id: "mock_3", subject: "Mathematics", chapterName: "Matrices", uploadDate: "14 May 2026", pdfSize: "2.4 MB", pdfUrl: "#" }
    ];

    function renderNotes(filterSubject = 'all', searchQuery = '') {
        if (!notesGrid) return;
        notesGrid.innerHTML = '';
        let count = 0;

        const dataToRender = allNotesData.length > 0 ? allNotesData : fallbackMockNotes;

        dataToRender.forEach(note => {
            // Apply Filters
            if (filterSubject !== 'all' && note.subject !== filterSubject) {
                return;
            }

            const searchStr = `${note.subject} ${note.chapterName}`.toLowerCase();
            if (searchQuery && !searchStr.includes(searchQuery.toLowerCase())) {
                return;
            }

            count++;
            
            const card = document.createElement('div');
            card.className = 'doubt-card'; // Reusing doubt-card glassmorphism style

            card.innerHTML = `
                <div class="doubt-header" style="border-bottom: none; margin-bottom: 0;">
                    <div class="doubt-student-info">
                        <div class="stat-icon blue" style="width: 45px; height: 45px;"><i class="fa-solid fa-file-pdf"></i></div>
                        <div class="doubt-meta">
                            <h4>${note.chapterName}</h4>
                            <p><i class="fa-solid fa-book"></i> ${note.subject}</p>
                        </div>
                    </div>
                </div>
                <div class="doubt-body" style="margin-top: 15px;">
                    <div class="doubt-text" style="font-style: normal; font-size: 0.9rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span style="color: var(--text-muted);"><i class="fa-regular fa-calendar"></i> Uploaded:</span>
                            <span style="color: var(--text-main); font-weight: 500;">${note.uploadDate}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--text-muted);"><i class="fa-solid fa-weight-hanging"></i> Size:</span>
                            <span style="color: var(--text-main); font-weight: 500;">${note.pdfSize}</span>
                        </div>
                    </div>
                </div>
                <div class="doubt-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn-small outline view-btn" data-url="${note.pdfUrl}">
                        <i class="fa-solid fa-eye"></i> View PDF
                    </button>
                    <button class="btn-small outline edit-btn" data-id="${note.id}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button class="btn-small outline delete-btn" data-id="${note.id}" data-url="${note.pdfUrl}" style="color: var(--danger); border-color: rgba(255, 51, 102, 0.3);">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            `;
            notesGrid.appendChild(card);
        });

        if (count === 0 && emptyStateNotes) {
            emptyStateNotes.style.display = 'flex';
        } else if (emptyStateNotes) {
            emptyStateNotes.style.display = 'none';
        }

        // Attach Event Listeners to Buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.getAttribute('data-url');
                if (url && url !== '#') {
                    window.open(url, '_blank');
                } else {
                    alert('PDF Viewer Mock: This opens the PDF document.');
                }
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                alert('Edit feature coming soon!');
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm("Are you sure you want to delete this note?")) {
                    const noteId = e.currentTarget.getAttribute('data-id');
                    const pdfUrl = e.currentTarget.getAttribute('data-url');
                    
                    if (noteId.startsWith('mock_')) {
                        alert("Cannot delete mock data.");
                        return;
                    }

                    try {
                        const btnEl = e.currentTarget;
                        btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                        
                        await deleteDoc(doc(db, "notes", noteId));
                        
                        // Try to delete from storage if url exists
                        if (pdfUrl && pdfUrl.includes('firebasestorage')) {
                            const fileRef = ref(storage, pdfUrl);
                            try {
                                await deleteObject(fileRef);
                            } catch (e) {
                                console.error("Error deleting file from storage", e);
                            }
                        }
                    } catch (error) {
                        console.error("Error deleting document: ", error);
                        alert("Failed to delete.");
                    }
                }
            });
        });
    }

    function setupNotesListener() {
        const mentorEmail = currentUserEmail || "mentor@edubridge.com"; 
        const q = query(collection(db, "notes"), where("mentorEmail", "==", mentorEmail));

        try {
            onSnapshot(q, (snapshot) => {
                allNotesData = [];
                snapshot.forEach((doc) => {
                    allNotesData.push({ id: doc.id, ...doc.data() });
                });
                
                allNotesData.sort((a, b) => {
                    const timeA = a.timestamp ? (a.timestamp.toMillis ? a.timestamp.toMillis() : a.timestamp) : 0;
                    const timeB = b.timestamp ? (b.timestamp.toMillis ? b.timestamp.toMillis() : b.timestamp) : 0;
                    return timeB - timeA;
                });

                // Only render actual Firebase data if there's any, otherwise it falls back to mock inside renderNotes
                renderNotes(subjectFilter ? subjectFilter.value : 'all', notesSearch ? notesSearch.value : '');
            }, (error) => {
                console.error("Error fetching notes real-time: ", error);
                // Fallback to mock on error
                renderNotes(subjectFilter ? subjectFilter.value : 'all', notesSearch ? notesSearch.value : '');
            });
        } catch (e) {
            console.error("Firestore error: ", e);
            renderNotes(subjectFilter ? subjectFilter.value : 'all', notesSearch ? notesSearch.value : '');
        }
    }

    // Toggle Upload Panel
    if (uploadNotesBtn) {
        uploadNotesBtn.addEventListener('click', () => {
            uploadPanel.style.display = uploadPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (closeUploadBtn) {
        closeUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            uploadPanel.style.display = 'none';
        });
    }

    // Handle File Selection
    if (browseFilesText && pdfFileInput) {
        browseFilesText.addEventListener('click', () => {
            pdfFileInput.click();
        });
    }

    if (dragDropZone && pdfFileInput) {
        dragDropZone.addEventListener('click', (e) => {
            if (e.target.tagName !== 'SPAN') {
                pdfFileInput.click();
            }
        });

        dragDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dragDropZone.style.borderColor = 'var(--primary-purple)';
            dragDropZone.style.background = 'rgba(157, 0, 255, 0.1)';
        });

        dragDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragDropZone.style.borderColor = '';
            dragDropZone.style.background = '';
        });

        dragDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDropZone.style.borderColor = '';
            dragDropZone.style.background = '';
            
            if (e.dataTransfer.files.length > 0) {
                pdfFileInput.files = e.dataTransfer.files;
                handleFileSelect();
            }
        });
    }

    if (pdfFileInput) {
        pdfFileInput.addEventListener('change', handleFileSelect);
    }

    function handleFileSelect() {
        if (pdfFileInput.files.length > 0) {
            const file = pdfFileInput.files[0];
            selectedFileName.innerHTML = `<i class="fa-solid fa-check" style="color: var(--success);"></i> Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        } else {
            selectedFileName.textContent = '';
        }
    }

    // Handle Upload Submission
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const subject = document.getElementById('uploadSubject').value;
            const chapterName = document.getElementById('uploadChapter').value.trim();
            const file = pdfFileInput.files[0];

            if (!file) {
                alert("Please select a PDF file to upload.");
                return;
            }

            const submitBtn = uploadForm.querySelector('button[type="submit"]');
            const originalBtnContent = submitBtn.innerHTML;
            
            try {
                submitBtn.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Uploading...</span>';
                submitBtn.disabled = true;

                const timestamp = new Date().getTime();
                const uploadDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                const fileSizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

                let pdfUrl = "#";
                
                try {
                    const storageRef = ref(storage, `notes/${timestamp}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    pdfUrl = await getDownloadURL(snapshot.ref);
                } catch(storageError) {
                    console.error("Storage upload failed, using mock URL. Ensure Firebase config is set.", storageError);
                }

                const noteData = {
                    subject: subject,
                    chapterName: chapterName,
                    mentorEmail: currentUserEmail || "mentor@edubridge.com",
                    mentorName: mentorData.name,
                    uploadDate: uploadDateStr,
                    pdfSize: fileSizeStr,
                    pdfUrl: pdfUrl,
                    timestamp: serverTimestamp()
                };

                await addDoc(collection(db, "notes"), noteData);
                
                // Success
                submitBtn.innerHTML = '<span><i class="fa-solid fa-check"></i> Uploaded!</span>';
                submitBtn.style.background = 'var(--success)';
                
                setTimeout(() => {
                    submitBtn.innerHTML = originalBtnContent;
                    submitBtn.style.background = '';
                    submitBtn.disabled = false;
                    uploadForm.reset();
                    selectedFileName.textContent = '';
                    uploadPanel.style.display = 'none';
                }, 2000);

            } catch (error) {
                console.error("Error uploading note: ", error);
                alert("Failed to upload note. Ensure Firebase config is correct.");
                submitBtn.innerHTML = originalBtnContent;
                submitBtn.disabled = false;
            }
        });
    }

    // Filters and Search Events
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

    // Initial Render & Setup
    setupNotesListener();

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

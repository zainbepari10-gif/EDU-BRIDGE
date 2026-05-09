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

    // ---- DATA FETCHING (LOCAL STORAGE FALLBACK LAYER) ----
    function getLocalData(keyName, defaultData = []) {
        try {
            const raw = localStorage.getItem(`${keyName}_${currentUserEmail}`);
            return raw ? JSON.parse(raw) : defaultData;
        } catch (e) {
            return defaultData;
        }
    }

    // Since we don't have a live DB connection for analytics built-in yet, we use the local caches updated by other pages
    const students = getLocalData('mentor_students', [
        // Mock fallback if empty
        { id: "mock_s1", name: "Aarav Sharma", course: "Computer Science", productivity: 92, status: "Active", streak: 5 },
        { id: "mock_s2", name: "Priya Patel", course: "Physics", productivity: 85, status: "Active", streak: 3 },
        { id: "mock_s3", name: "Rahul Verma", course: "Mathematics", productivity: 45, status: "Active", streak: 0 },
        { id: "mock_s4", name: "Sneha Iyer", course: "Chemistry", productivity: 78, status: "Active", streak: 2 }
    ]);

    const assignments = getLocalData('mentor_assignments', [
        { totalStudents: 32, totalSubmissions: 18 }
    ]);

    // ---- CALCULATE METRICS ----
    
    // 1. Total Students
    const activeStudents = students.filter(s => s.status === 'Active');
    document.getElementById('totalStudentsStat').textContent = activeStudents.length;

    // 2. Average Productivity
    let totalProd = 0;
    students.forEach(s => totalProd += (s.productivity || 0));
    const avgProd = students.length > 0 ? Math.round(totalProd / students.length) : 0;
    
    const avgProdEl = document.getElementById('avgProductivityStat');
    avgProdEl.textContent = `${avgProd}%`;
    
    const prodTrendEl = document.getElementById('avgProductivityTrend');
    if (avgProd >= 80) {
        prodTrendEl.className = "trend positive";
        prodTrendEl.innerHTML = `<i class="fa-solid fa-arrow-up"></i> Excellent`;
        avgProdEl.style.color = 'var(--success)';
    } else if (avgProd >= 50) {
        prodTrendEl.className = "trend warning";
        prodTrendEl.innerHTML = `<i class="fa-solid fa-minus"></i> Stable`;
        avgProdEl.style.color = 'var(--warning)';
    } else {
        prodTrendEl.className = "trend negative";
        prodTrendEl.innerHTML = `<i class="fa-solid fa-arrow-down"></i> Needs Work`;
        avgProdEl.style.color = 'var(--danger)';
    }

    // 3. Assignment Completion
    let totalAssigned = 0;
    let totalSubmitted = 0;
    assignments.forEach(a => {
        totalAssigned += (a.totalStudents || 0);
        totalSubmitted += (a.totalSubmissions || 0);
    });
    const completionRate = totalAssigned > 0 ? Math.round((totalSubmitted / totalAssigned) * 100) : 0;
    document.getElementById('assignmentCompletionStat').textContent = `${completionRate}%`;

    // 4. Avg Streak
    let totalStreak = 0;
    students.forEach(s => totalStreak += (s.streak || Math.floor(Math.random() * 5))); // Mocking streak if missing
    const avgStreak = students.length > 0 ? Math.round(totalStreak / students.length) : 0;
    document.getElementById('avgStreakStat').textContent = `${avgStreak} Days`;

    // ---- POPULATE AI LISTS ----
    
    const topPerformersList = document.getElementById('topPerformersList');
    const attentionRequiredList = document.getElementById('attentionRequiredList');
    
    topPerformersList.innerHTML = '';
    attentionRequiredList.innerHTML = '';

    const sortedStudents = [...students].sort((a, b) => (b.productivity || 0) - (a.productivity || 0));
    
    let hasTop = false;
    let hasAttention = false;

    sortedStudents.forEach(student => {
        const prod = student.productivity || 0;
        
        // Template for list items
        const createListItem = (isDanger) => {
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="https://ui-avatars.com/api/?name=${student.name}&background=random" style="width: 35px; height: 35px; border-radius: 50%;">
                        <div>
                            <h4 style="font-size: 0.9rem; margin-bottom: 2px;">${student.name}</h4>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">${student.course}</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700; color: ${isDanger ? 'var(--danger)' : 'var(--success)'};">${prod}%</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">Productivity</div>
                    </div>
                </div>
            `;
        };

        if (prod >= 80) {
            topPerformersList.innerHTML += createListItem(false);
            hasTop = true;
        } else if (prod < 60) {
            const aiMessage = prod < 40 ? "Critical drop in activity. Intervention needed." : "Missing recent assignments. Send reminder.";
            attentionRequiredList.innerHTML += `
                <div style="padding: 12px; background: rgba(255,51,102,0.05); border-left: 3px solid var(--danger); border-radius: 6px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="https://ui-avatars.com/api/?name=${student.name}&background=random" style="width: 30px; height: 30px; border-radius: 50%;">
                            <h4 style="font-size: 0.9rem;">${student.name}</h4>
                        </div>
                        <span style="color: var(--danger); font-weight: 700;">${prod}%</span>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;"><i class="fa-solid fa-lightbulb" style="color: var(--warning);"></i> <b>AI Insight:</b> ${aiMessage}</p>
                    <button class="btn-small outline" onclick="alert('Sending automated check-in email to ${student.name}')" style="font-size: 0.75rem; padding: 4px 10px; border-color: rgba(255,255,255,0.2);">Send Check-in</button>
                </div>
            `;
            hasAttention = true;
        }
    });

    if (!hasTop) topPerformersList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">No top performers found yet.</div>';
    if (!hasAttention) attentionRequiredList.innerHTML = '<div style="color: var(--success); font-size: 0.85rem; text-align: center; padding: 20px;"><i class="fa-solid fa-check-circle"></i> All students are performing well. No critical alerts.</div>';

    // ---- CHART.JS INITIALIZATION ----
    
    const ctx = document.getElementById('productivityChart');
    
    if (ctx) {
        // Generate trend data based on avgProd
        // Just mocking 7 days of data leading up to the current average
        const baseVal = Math.max(40, avgProd - 15);
        const dataPoints = [
            baseVal, 
            baseVal + 5, 
            baseVal + 2, 
            baseVal + 10, 
            baseVal + 8, 
            avgProd - 2, 
            avgProd
        ];
        
        const labels = [];
        for(let i=6; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        }

        // Create gradient for chart line
        const canvas = ctx.getContext('2d');
        const gradientLine = canvas.createLinearGradient(0, 0, 800, 0);
        gradientLine.addColorStop(0, '#00e1ff');
        gradientLine.addColorStop(1, '#9d00ff');

        const gradientFill = canvas.createLinearGradient(0, 0, 0, 300);
        gradientFill.addColorStop(0, 'rgba(157, 0, 255, 0.2)');
        gradientFill.addColorStop(1, 'rgba(0, 225, 255, 0)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Class Productivity (%)',
                    data: dataPoints,
                    borderColor: gradientLine,
                    backgroundColor: gradientFill,
                    borderWidth: 3,
                    pointBackgroundColor: '#0f0f19',
                    pointBorderColor: '#00e1ff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4 // Smooth curves
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 25, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#00e1ff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `Score: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { family: 'Inter', size: 11 },
                            stepSize: 20
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.5)',
                            font: { family: 'Inter', size: 11 }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
            }
        });
    }

    // Export Report
    document.getElementById('exportReportBtn')?.addEventListener('click', () => {
        alert("Downloading comprehensive Analytics PDF Report...");
    });

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

/**
 * Riskhanterare - Frontend JavaScript
 * Hanterar UI-logik, API-anrop och interaktioner
 * OAuth-autentisering via Nextcloud
 */

// ============================================================================
// GLOBALA VARIABLER
// ============================================================================

let allRisks = [];
let config = {};
let currentEditingRiskId = null;
let currentUser = null;
let autoRefreshInterval = null;
const AUTO_REFRESH_INTERVAL = 5000; // 5 sekunder

// ============================================================================
// INITIALISERING
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Initialiserar riskhanteraren...');
    
    // Kontrollera autentisering
    await checkAuth();
    
    // Om användare är inloggad, ladda data
    if (currentUser) {
        // Ladda konfiguration
        await loadConfig();
        
        // Ladda risker
        await loadRisks();
        
        // Sätt upp event listeners
        setupEventListeners();
        
        // Sätt dagens datum som standard
        document.getElementById('riskDate').valueAsDate = new Date();
        
        // Starta auto-refresh
        startAutoRefresh();
    }
});

// ============================================================================
// AUTENTISERING
// ============================================================================

async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        const result = await response.json();
        
        if (result.user) {
            currentUser = result.user;
            showMainContent();
            console.log('Användare inloggad:', currentUser.name);
        } else {
            showLoginContent();
        }
    } catch (error) {
        console.error('Fel vid autentiseringskontroll:', error);
        showLoginContent();
    }
}

function showLoginContent() {
    const container = document.getElementById('risksContainer');
    container.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <h2>🔐 Logga in</h2>
                <p>Du måste logga in med ditt Nextcloud-konto för att använda riskhanteraren.</p>
                <a href="/login" class="btn btn-primary btn-large">Logga in med Nextcloud</a>
            </div>
        </div>
    `;
    
    // Dölj övriga element
    document.querySelector('.filters-section').style.display = 'none';
    document.querySelector('.stats-section').style.display = 'none';
    document.querySelector('.header-actions').style.display = 'none';
}

function showMainContent() {
    document.querySelector('.filters-section').style.display = 'grid';
    document.querySelector('.stats-section').style.display = 'grid';
    document.querySelector('.header-actions').style.display = 'flex';
    
    // Lägg till logout-knapp
    const headerActions = document.querySelector('.header-actions');
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-secondary';
    logoutBtn.textContent = `🚪 Logga ut (${currentUser.name})`;
    logoutBtn.addEventListener('click', () => {
        window.location.href = '/logout';
    });
    headerActions.appendChild(logoutBtn);
}

// ============================================================================
// KONFIGURATION
// ============================================================================

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        config = await response.json();
        
        // Fyll i kategorier i formulär och filter
        populateCategorySelects();
        populateStatusSelects();
        
        console.log('Konfiguration laddad:', config);
    } catch (error) {
        console.error('Fel vid laddning av konfiguration:', error);
        showNotification('Fel vid laddning av konfiguration', 'error');
    }
}

function populateCategorySelects() {
    const categorySelects = [
        document.getElementById('categoryFilter'),
        document.getElementById('riskCategory')
    ];
    
    categorySelects.forEach(select => {
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '';
            
            if (select.id === 'categoryFilter') {
                const option = document.createElement('option');
                option.value = 'Alla';
                option.textContent = 'Alla kategorier';
                select.appendChild(option);
            }
            
            config.categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
            
            if (currentValue) select.value = currentValue;
        }
    });
}

function populateStatusSelects() {
    const statusSelects = [
        document.getElementById('statusFilter'),
        document.getElementById('riskStatus')
    ];
    
    statusSelects.forEach(select => {
        if (select) {
            const currentValue = select.value;
            
            if (select.id === 'statusFilter') {
                select.innerHTML = '<option value="">Alla</option>';
                config.statuses.forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    select.appendChild(option);
                });
            } else {
                select.innerHTML = '';
                config.statuses.forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    select.appendChild(option);
                });
            }
            
            if (currentValue) select.value = currentValue;
        }
    });
}

// ============================================================================
// LADDA RISKER
// ============================================================================

async function loadRisks() {
    try {
        const response = await fetch('/api/risks');
        const result = await response.json();
        
        if (result.success) {
            allRisks = result.data;
            renderRisks(allRisks);
            updateStatistics();
            console.log('Risker laddade:', allRisks.length);
        } else {
            showNotification('Kunde inte ladda risker', 'error');
        }
    } catch (error) {
        console.error('Fel vid laddning av risker:', error);
        showNotification('Fel vid laddning av risker', 'error');
    }
}

// ============================================================================
// RENDERA RISKER
// ============================================================================

function renderRisks(risks) {
    const container = document.getElementById('risksContainer');
    
    if (risks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>Inga risker hittades</h3>
                <p>Börja med att skapa en ny risk genom att klicka på "Ny risk"-knappen.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = risks.map(risk => createRiskCard(risk)).join('');
    
    // Lägg till event listeners för risk-kort
    document.querySelectorAll('.risk-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.risk-actions')) {
                showRiskDetail(card.dataset.riskId);
            }
        });
    });
    
    // Lägg till event listeners för knappar
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editRisk(btn.dataset.riskId);
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteRisk(btn.dataset.riskId);
        });
    });
}

function createRiskCard(risk) {
    const riskClass = `risk-${risk.risk_level.level.toLowerCase()}`;
    const badgeClass = risk.risk_level.level.toLowerCase();
    
    return `
        <div class="risk-card ${riskClass}" data-risk-id="${risk.id}">
            <div class="risk-header">
                <h3 class="risk-title">${escapeHtml(risk.title)}</h3>
                <span class="risk-badge ${badgeClass}">${risk.risk_level.level}</span>
            </div>
            
            <div class="risk-meta">
                <div class="risk-meta-item">
                    <span class="risk-meta-label">Kategori</span>
                    <span class="risk-meta-value">${escapeHtml(risk.category)}</span>
                </div>
                <div class="risk-meta-item">
                    <span class="risk-meta-label">Sannolikhet</span>
                    <span class="risk-meta-value">${risk.probability}/5</span>
                </div>
                <div class="risk-meta-item">
                    <span class="risk-meta-label">Konsekvens</span>
                    <span class="risk-meta-value">${risk.consequence}/5</span>
                </div>
                <div class="risk-meta-item">
                    <span class="risk-meta-label">Riskvärde</span>
                    <span class="risk-meta-value" style="color: ${risk.risk_level.color}; font-weight: bold;">
                        ${risk.risk_value}
                    </span>
                </div>
            </div>
            
            ${risk.description ? `<div class="risk-description">${escapeHtml(risk.description.substring(0, 150))}...</div>` : ''}
            
            <div class="risk-footer">
                <span class="risk-status">${escapeHtml(risk.status)}</span>
                <div class="risk-actions">
                    <button class="btn btn-small btn-primary btn-edit" data-risk-id="${risk.id}">Redigera</button>
                    <button class="btn btn-small btn-danger btn-delete" data-risk-id="${risk.id}">Ta bort</button>
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// STATISTIK
// ============================================================================

function updateStatistics() {
    const total = allRisks.length;
    const high = allRisks.filter(r => r.risk_level.level === 'Hög').length;
    const medium = allRisks.filter(r => r.risk_level.level === 'Medel').length;
    const low = allRisks.filter(r => r.risk_level.level === 'Låg').length;
    
    document.getElementById('totalRisks').textContent = total;
    document.getElementById('highRisks').textContent = high;
    document.getElementById('mediumRisks').textContent = medium;
    document.getElementById('lowRisks').textContent = low;
}

// ============================================================================
// FILTRERING OCH SÖKNING
// ============================================================================

function applyFilters() {
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    let filtered = allRisks;
    
    // Filtrera efter kategori
    if (category && category !== 'Alla') {
        filtered = filtered.filter(r => r.category === category);
    }
    
    // Filtrera efter status
    if (status) {
        filtered = filtered.filter(r => r.status === status);
    }
    
    // Filtrera efter sökterm
    if (searchTerm) {
        filtered = filtered.filter(r => 
            r.title.toLowerCase().includes(searchTerm) ||
            r.description.toLowerCase().includes(searchTerm)
        );
    }
    
    renderRisks(filtered);
}

// ============================================================================
// MODAL-HANTERING
// ============================================================================

function openRiskModal(riskId = null) {
    const modal = document.getElementById('riskModal');
    const form = document.getElementById('riskForm');
    const title = document.getElementById('modalTitle');
    
    if (riskId) {
        title.textContent = 'Redigera risk';
        currentEditingRiskId = riskId;
        
        const risk = allRisks.find(r => r.id === parseInt(riskId));
        if (risk) {
            document.getElementById('riskTitle').value = risk.title;
            document.getElementById('riskCategory').value = risk.category;
            document.getElementById('riskDescription').value = risk.description;
            document.getElementById('riskProbability').value = risk.probability;
            document.getElementById('riskConsequence').value = risk.consequence;
            document.getElementById('riskOwner').value = risk.owner;
            document.getElementById('riskMitigation').value = risk.mitigation;
            document.getElementById('riskStatus').value = risk.status;
            document.getElementById('riskDate').value = risk.created_date.split('T')[0];
            
            updateRiskValue();
        }
    } else {
        title.textContent = 'Ny risk';
        currentEditingRiskId = null;
        form.reset();
        document.getElementById('riskDate').valueAsDate = new Date();
        document.getElementById('riskValueDisplay').textContent = '-';
        document.getElementById('riskLevelDisplay').textContent = '-';
    }
    
    modal.classList.add('active');
}

function closeRiskModal() {
    document.getElementById('riskModal').classList.remove('active');
    document.getElementById('riskForm').reset();
    currentEditingRiskId = null;
}

function openDetailModal(riskId) {
    const risk = allRisks.find(r => r.id === parseInt(riskId));
    if (!risk) return;
    
    const modal = document.getElementById('detailModal');
    const body = document.getElementById('detailBody');
    
    document.getElementById('detailTitle').textContent = escapeHtml(risk.title);
    
    body.innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">Grundinformation</div>
            <div class="detail-item">
                <div class="detail-label">Titel</div>
                <div class="detail-value">${escapeHtml(risk.title)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Kategori</div>
                <div class="detail-value">${escapeHtml(risk.category)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Datum</div>
                <div class="detail-value">${new Date(risk.created_date).toLocaleDateString('sv-SE')}</div>
            </div>
            ${risk.description ? `
                <div class="detail-item">
                    <div class="detail-label">Beskrivning</div>
                    <div class="detail-value">${escapeHtml(risk.description)}</div>
                </div>
            ` : ''}
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">Riskbedömning</div>
            <div class="detail-item">
                <div class="detail-label">Sannolikhet</div>
                <div class="detail-value">${risk.probability}/5</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Konsekvens</div>
                <div class="detail-value">${risk.consequence}/5</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Riskvärde</div>
                <div class="detail-value risk-value-display" style="color: ${risk.risk_level.color};">
                    ${risk.risk_value} (${risk.risk_level.level})
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">Ansvar & Åtgärd</div>
            <div class="detail-item">
                <div class="detail-label">Ägare</div>
                <div class="detail-value">${risk.owner || '-'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value">${escapeHtml(risk.status)}</div>
            </div>
            ${risk.mitigation ? `
                <div class="detail-item">
                    <div class="detail-label">Åtgärd</div>
                    <div class="detail-value">${escapeHtml(risk.mitigation)}</div>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('editDetailBtn').onclick = () => {
        closeDetailModal();
        editRisk(riskId);
    };
    
    document.getElementById('deleteDetailBtn').onclick = () => {
        closeDetailModal();
        deleteRisk(riskId);
    };
    
    modal.classList.add('active');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
}

// ============================================================================
// RISK-OPERATIONER
// ============================================================================

async function saveRisk(e) {
    e.preventDefault();
    
    const formData = {
        title: document.getElementById('riskTitle').value,
        category: document.getElementById('riskCategory').value,
        description: document.getElementById('riskDescription').value,
        probability: parseInt(document.getElementById('riskProbability').value),
        consequence: parseInt(document.getElementById('riskConsequence').value),
        owner: document.getElementById('riskOwner').value,
        mitigation: document.getElementById('riskMitigation').value,
        status: document.getElementById('riskStatus').value,
        created_date: document.getElementById('riskDate').value
    };
    
    // Validering
    if (!formData.title || !formData.category) {
        showNotification('Titel och kategori är obligatoriska', 'error');
        return;
    }
    
    try {
        let response;
        
        if (currentEditingRiskId) {
            // Uppdatera befintlig risk
            response = await fetch(`/api/risks/${currentEditingRiskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            // Skapa ny risk
            response = await fetch('/api/risks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(
                currentEditingRiskId ? 'Risk uppdaterad' : 'Risk skapad',
                'success'
            );
            closeRiskModal();
            await loadRisks();
            updateStatistics();
        } else {
            showNotification(result.error || 'Fel vid sparande', 'error');
        }
    } catch (error) {
        console.error('Fel vid sparande:', error);
        showNotification('Fel vid sparande av risk', 'error');
    }
}

function editRisk(riskId) {
    openRiskModal(riskId);
}

async function deleteRisk(riskId) {
    if (!confirm('Är du säker på att du vill ta bort denna risk?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/risks/${riskId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Risk borttagen', 'success');
            await loadRisks();
            updateStatistics();
        } else {
            showNotification('Fel vid borttagning', 'error');
        }
    } catch (error) {
        console.error('Fel vid borttagning:', error);
        showNotification('Fel vid borttagning av risk', 'error');
    }
}

function showRiskDetail(riskId) {
    openDetailModal(riskId);
}

// ============================================================================
// RISKVÄRDE-BERÄKNING
// ============================================================================

function updateRiskValue() {
    const probability = parseInt(document.getElementById('riskProbability').value) || 0;
    const consequence = parseInt(document.getElementById('riskConsequence').value) || 0;
    
    if (probability && consequence) {
        const riskValue = probability * consequence;
        document.getElementById('riskValueDisplay').textContent = riskValue;
        
        // Bestäm risknivå
        let level = '-';
        if (riskValue >= 15) {
            level = 'Hög';
        } else if (riskValue >= 5) {
            level = 'Medel';
        } else if (riskValue > 0) {
            level = 'Låg';
        }
        
        document.getElementById('riskLevelDisplay').textContent = level;
    } else {
        document.getElementById('riskValueDisplay').textContent = '-';
        document.getElementById('riskLevelDisplay').textContent = '-';
    }
}

// ============================================================================
// EXPORT
// ============================================================================

async function exportToCSV() {
    try {
        const response = await fetch('/api/export/csv');
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `riskregister_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Risker exporterade till CSV', 'success');
    } catch (error) {
        console.error('Fel vid export:', error);
        showNotification('Fel vid export', 'error');
    }
}

// ============================================================================
// NOTIFIKATIONER
// ============================================================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // Ny risk
    document.getElementById('newRiskBtn').addEventListener('click', () => openRiskModal());
    
    // Stäng modal
    document.getElementById('closeModalBtn').addEventListener('click', closeRiskModal);
    document.getElementById('cancelBtn').addEventListener('click', closeRiskModal);
    document.getElementById('closeDetailBtn').addEventListener('click', closeDetailModal);
    document.getElementById('closeDetailFooterBtn').addEventListener('click', closeDetailModal);
    
    // Formulär
    document.getElementById('riskForm').addEventListener('submit', saveRisk);
    
    // Filtrering
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    
    // Export
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    
    // Stäng modal när man klickar utanför
    document.getElementById('riskModal').addEventListener('click', (e) => {
        if (e.target.id === 'riskModal') closeRiskModal();
    });
    
    document.getElementById('detailModal').addEventListener('click', (e) => {
        if (e.target.id === 'detailModal') closeDetailModal();
    });
}

// ============================================================================
// UTILITY-FUNKTIONER
// ============================================================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Lägg till CSS för animationer
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 400px;
    }
    
    .login-card {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        text-align: center;
        max-width: 400px;
    }
    
    .login-card h2 {
        margin-bottom: 1rem;
        color: #0066cc;
    }
    
    .login-card p {
        margin-bottom: 1.5rem;
        color: #666;
    }
    
    .btn-large {
        padding: 1rem 2rem;
        font-size: 1rem;
        width: 100%;
    }
`;
document.head.appendChild(style);

// ============================================================================
// AUTO-REFRESH OCH SYNK
// ============================================================================

function startAutoRefresh() {
    console.log('Startar auto-refresh (var 5:e sekund)...');
    
    // Starta auto-refresh
    autoRefreshInterval = setInterval(async () => {
        try {
            await loadRisks();
        } catch (error) {
            console.error('Fel vid auto-refresh:', error);
        }
    }, AUTO_REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('Auto-refresh stoppat');
    }
}

function manualRefresh() {
    console.log('Manuell uppdatering...');
    loadRisks();
    showNotification('Data uppdaterad', 'success');
}

// Lägg till refresh-knapp
document.addEventListener('DOMContentLoaded', () => {
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'btn btn-secondary';
        refreshBtn.textContent = '🔄 Uppdatera';
        refreshBtn.addEventListener('click', manualRefresh);
        headerActions.insertBefore(refreshBtn, headerActions.firstChild);
    }
});

// Stäng auto-refresh när sidan laddas bort
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});

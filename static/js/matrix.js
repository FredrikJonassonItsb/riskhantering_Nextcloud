// Riskmatris JavaScript

let allRisks = [];

// Initiera riskmatris
async function initializeMatrix() {
    console.log('Initialiserar riskmatris...');
    
    // Ladda risker
    await loadRisks();
    
    // Ladda kategorier
    await loadCategories();
    
    // Uppdatera matris
    updateMatrix();
    
    // Uppdatera tabell
    updateRisksTable();
    
    // Event listeners
    document.getElementById('refreshBtn').addEventListener('click', async () => {
        await loadRisks();
        updateMatrix();
        updateRisksTable();
    });
    
    document.getElementById('matrixCategoryFilter').addEventListener('change', updateRisksTable);
    document.getElementById('matrixSearchInput').addEventListener('input', updateRisksTable);
    
    // Klick på matrixceller
    document.querySelectorAll('.matrix-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const prob = parseInt(cell.dataset.prob);
            const cons = parseInt(cell.dataset.cons);
            filterByRiskValue(prob, cons);
        });
    });
}

// Ladda risker från API
async function loadRisks() {
    try {
        const response = await fetch('/api/risks');
        if (!response.ok) throw new Error('Kunde inte ladda risker');
        allRisks = await response.json();
        console.log(`Laddade ${allRisks.length} risker`);
    } catch (error) {
        console.error('Fel vid laddning av risker:', error);
        allRisks = [];
    }
}

// Ladda kategorier
async function loadCategories() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Kunde inte ladda konfiguration');
        const config = await response.json();
        
        const categorySelect = document.getElementById('matrixCategoryFilter');
        categorySelect.innerHTML = '<option value="">Alla kategorier</option>';
        
        config.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Fel vid laddning av kategorier:', error);
    }
}

// Uppdatera matris med risker
function updateMatrix() {
    // Rensa alla celler från tidigare risker
    document.querySelectorAll('.matrix-cell').forEach(cell => {
        cell.innerHTML = '';
        cell.dataset.riskCount = '0';
    });
    
    // Lägg till risker i rätt celler
    allRisks.forEach(risk => {
        const prob = parseInt(risk.probability) || 1;
        const cons = parseInt(risk.consequence) || 1;
        
        const cell = document.querySelector(`.cell-${prob}-${cons}`);
        if (cell) {
            const currentCount = parseInt(cell.dataset.riskCount) || 0;
            cell.dataset.riskCount = currentCount + 1;
            
            // Visa antal risker i cellen
            if (currentCount + 1 > 0) {
                cell.innerHTML = `<span class="risk-count">${currentCount + 1}</span>`;
            }
        }
    });
}

// Uppdatera risktabellen
function updateRisksTable() {
    const categoryFilter = document.getElementById('matrixCategoryFilter').value;
    const searchInput = document.getElementById('matrixSearchInput').value.toLowerCase();
    
    // Filtrera risker
    let filteredRisks = allRisks.filter(risk => {
        const matchCategory = !categoryFilter || risk.category === categoryFilter;
        const matchSearch = !searchInput || 
                          risk.title.toLowerCase().includes(searchInput) ||
                          risk.description.toLowerCase().includes(searchInput);
        return matchCategory && matchSearch;
    });
    
    // Sortera efter riskvärde (högsta först)
    filteredRisks.sort((a, b) => (b.risk_value || 0) - (a.risk_value || 0));
    
    // Uppdatera tabell
    const tbody = document.getElementById('matrixRisksTableBody');
    
    if (filteredRisks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Inga risker hittades</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredRisks.map(risk => `
        <tr>
            <td><strong>${escapeHtml(risk.title)}</strong></td>
            <td>${escapeHtml(risk.category)}</td>
            <td style="text-align: center;">${risk.probability || '-'}</td>
            <td style="text-align: center;">${risk.consequence || '-'}</td>
            <td style="text-align: center; font-weight: 600;">${risk.risk_value || '-'}</td>
            <td>${getRiskLevelBadge(risk.risk_level)}</td>
            <td>${getStatusBadge(risk.status, risk.id)}</td>
            <td>
                <div class="table-actions">
                    <button class="action-btn" onclick="editRisk(${risk.id})">Redigera</button>
                    <button class="action-btn delete" onclick="deleteRisk(${risk.id})">Ta bort</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filtrera efter riskvärde
function filterByRiskValue(prob, cons) {
    const filtered = allRisks.filter(risk => 
        parseInt(risk.probability) === prob && 
        parseInt(risk.consequence) === cons
    );
    
    console.log(`Risker med sannolikhet ${prob} och konsekvens ${cons}:`, filtered);
    
    // Visa risker i tabell
    const tbody = document.getElementById('matrixRisksTableBody');
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Inga risker med denna kombination</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(risk => `
        <tr>
            <td><strong>${escapeHtml(risk.title)}</strong></td>
            <td>${escapeHtml(risk.category)}</td>
            <td style="text-align: center;">${risk.probability || '-'}</td>
            <td style="text-align: center;">${risk.consequence || '-'}</td>
            <td style="text-align: center; font-weight: 600;">${risk.risk_value || '-'}</td>
            <td>${getRiskLevelBadge(risk.risk_level)}</td>
            <td>${getStatusBadge(risk.status, risk.id)}</td>
            <td>
                <div class="table-actions">
                    <button class="action-btn" onclick="editRisk(${risk.id})">Redigera</button>
                    <button class="action-btn delete" onclick="deleteRisk(${risk.id})">Ta bort</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Hämta risknivå-badge
function getRiskLevelBadge(level) {
    const badgeClass = {
        'Låg': 'risk-level-low',
        'Medel': 'risk-level-medium',
        'Hög': 'risk-level-high'
    }[level] || 'risk-level-low';
    
    return `<span class="risk-level-badge ${badgeClass}">${level || 'Okänd'}</span>`;
}

// Hämta status-badge
function getStatusBadge(status, riskId) {
    const badgeClass = status === 'Stängd' ? 'closed' : 
                      status === 'Under behandling' ? 'in-progress' : '';
    
    return `<span class="status-badge ${badgeClass}" onclick="showStatusMenu(event, ${riskId}, '${status}')" style="cursor: pointer;" title="Klicka för att ändra status">${status || 'Ny'}</span>`;
}

// Redigera risk
function editRisk(riskId) {
    // Omdirigera till huvudsidan med risk-ID för redigering
    window.location.href = `/?edit=${riskId}`;
}

// Ta bort risk
async function deleteRisk(riskId) {
    if (!confirm('Är du säker på att du vill ta bort denna risk?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/risks/${riskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            console.log('Risk borttagen');
            await loadRisks();
            updateMatrix();
            updateRisksTable();
        } else {
            alert('Kunde inte ta bort risk');
        }
    } catch (error) {
        console.error('Fel vid borttagning av risk:', error);
        alert('Fel vid borttagning av risk');
    }
}

// Visa status-meny
function showStatusMenu(event, riskId, currentStatus) {
    event.stopPropagation();
    
    // Hämta alla möjliga statusar från config
    fetch('/api/config')
        .then(r => r.json())
        .then(config => {
            const statuses = config.statuses || ['Ny', 'Under behandling', 'Stängd'];
            
            // Skapa meny
            const menu = document.createElement('div');
            menu.className = 'status-menu';
            menu.style.position = 'absolute';
            menu.style.zIndex = '1000';
            menu.style.backgroundColor = 'white';
            menu.style.border = '1px solid #ddd';
            menu.style.borderRadius = '4px';
            menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            menu.style.minWidth = '150px';
            
            statuses.forEach(status => {
                const item = document.createElement('div');
                item.style.padding = '10px 15px';
                item.style.cursor = 'pointer';
                item.style.borderBottom = '1px solid #eee';
                item.style.fontSize = '14px';
                item.style.color = currentStatus === status ? '#2196F3' : '#333';
                item.style.fontWeight = currentStatus === status ? '600' : 'normal';
                item.style.backgroundColor = currentStatus === status ? '#f0f7ff' : 'white';
                
                item.textContent = status;
                item.addEventListener('mouseover', () => {
                    item.style.backgroundColor = '#f5f5f5';
                });
                item.addEventListener('mouseout', () => {
                    item.style.backgroundColor = currentStatus === status ? '#f0f7ff' : 'white';
                });
                
                item.addEventListener('click', () => {
                    updateRiskStatus(riskId, status);
                    menu.remove();
                });
                
                menu.appendChild(item);
            });
            
            // Positionera menyn
            const rect = event.target.getBoundingClientRect();
            menu.style.top = (rect.bottom + 5) + 'px';
            menu.style.left = rect.left + 'px';
            
            document.body.appendChild(menu);
            
            // Ta bort menyn när man klickar någonstans
            setTimeout(() => {
                document.addEventListener('click', function removeMenu() {
                    menu.remove();
                    document.removeEventListener('click', removeMenu);
                });
            }, 0);
        })
        .catch(error => console.error('Fel vid hämtning av statusar:', error));
}

// Uppdatera risk-status
async function updateRiskStatus(riskId, newStatus) {
    try {
        // Hitta risken
        const risk = allRisks.find(r => r.id === riskId);
        if (!risk) {
            alert('Kunde inte hitta risken');
            return;
        }
        
        // Uppdatera status
        const updatedRisk = {
            title: risk.title,
            description: risk.description,
            category: risk.category,
            probability: risk.probability,
            consequence: risk.consequence,
            owner: risk.owner,
            mitigation: risk.mitigation,
            status: newStatus,
            created_date: risk.created_date
        };
        
        // Skicka uppdatering
        const response = await fetch(`/api/risks/${riskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedRisk)
        });
        
        if (response.ok) {
            console.log(`Status uppdaterad till: ${newStatus}`);
            // Ladda om risker och uppdatera vyn
            await loadRisks();
            updateMatrix();
            updateRisksTable();
        } else {
            alert('Kunde inte uppdatera status');
        }
    } catch (error) {
        console.error('Fel vid uppdatering av status:', error);
        alert('Fel vid uppdatering av status');
    }
}

// Escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Initiera när sidan är laddad
document.addEventListener('DOMContentLoaded', initializeMatrix);

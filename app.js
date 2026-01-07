// Constants & Helpers
const KEYS = { memos: 'minimi_memos', emotions: 'minimi_emotions', archives: 'minimi_archives', focus: 'minimi_focus' };
const NAVER_CLIENT_ID = 'vWmfW76p6UDTgqnMI2kI';
const NAVER_CLIENT_SECRET = 'd9Lv90JLJS';
const CORS_PROXY = 'https://corsproxy.io/?';

const getData = key => JSON.parse(localStorage.getItem(key) || '[]');
const setData = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const getToday = () => new Date().toISOString().split('T')[0];
const formatDate = iso => { const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; };
const escapeHtml = text => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
const getTypeIcon = type => ({ book: '📚', movie: '🎬', tv: '📺', game: '🎮', place: '🍽️' }[type] || '📄');
const getTypeName = type => ({ book: '책', movie: '영화', tv: '드라마', game: '게임', place: '식당' }[type] || '기타');

// State
let currentPage = 'memo', currentArchiveType = 'book', selectedMemoTag = '일상', selectedArchiveTypeModal = 'book';
let uploadedImage = null, attachedContent = null, calendarDate = new Date(), selectedCalendarDate = null;
let selectedPeriod = 'daily', currentViewMode = 'masonry', currentSearchType = 'book';
let timerInterval = null, timerSeconds = 25 * 60, isTimerRunning = false, isBreakTime = false, editingMemoId = null;
let isArchiveSearch = false;

// Initialize
function init() {
    initEmotionTimeSelectors();
    setEmotionTimeToNow();
    updateCurrentTimeDisplay();
    setInterval(updateCurrentTimeDisplay, 60000);
    renderMemos();
    renderArchives();
    renderEmotionGraph();
    loadTodayEmotions();
    updateReport();
    updateFocusStats();
}

function initEmotionTimeSelectors() {
    const h = document.getElementById('emotionHour'), m = document.getElementById('emotionMinute');
    for (let i = 0; i < 24; i++) h.innerHTML += `<option value="${i}">${i.toString().padStart(2,'0')}</option>`;
    for (let i = 0; i < 60; i += 5) m.innerHTML += `<option value="${i}">${i.toString().padStart(2,'0')}</option>`;
}

function setEmotionTimeToNow() {
    const now = new Date();
    document.getElementById('emotionHour').value = now.getHours();
    document.getElementById('emotionMinute').value = Math.floor(now.getMinutes() / 5) * 5;
}

function updateCurrentTimeDisplay() {
    const now = new Date();
    document.getElementById('currentTimeDisplay').textContent = `현재 ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

// Navigation
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    const navMap = { memo: 0, archive: 1, lab: 2 };
    if (navMap[page] !== undefined) document.querySelectorAll('.nav-item')[navMap[page]].classList.add('active');
    currentPage = page;
    if (page === 'archive') renderArchives();
    if (page === 'lab') { updateReport(); renderEmotionGraph(); }
}

function toggleViewMode() { document.getElementById('viewModeSelector').classList.toggle('active'); }
function setViewMode(mode) { currentViewMode = mode; document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode)); renderMemos(); }
function toggleMenu() { document.getElementById('menuOverlay').classList.toggle('active'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openAddModal() {
    if (currentPage === 'archive') { openModal('addArchiveModal'); }
    else { resetMemoModal(); openModal('addMemoModal'); }
}

function resetMemoModal() {
    document.getElementById('memoModalTitle').textContent = '새 메모';
    document.getElementById('memoTitle').value = '';
    document.getElementById('memoContent').value = '';
    document.getElementById('editMemoId').value = '';
    document.getElementById('memoSubmitBtn').textContent = '저장';
    document.getElementById('imageUploadArea').innerHTML = '<div class="upload-icon">📷</div><div class="upload-text">클릭해서 이미지 추가</div><input type="file" accept="image/*" onchange="handleImageUpload(event)" style="display:none;">';
    document.getElementById('imageUploadArea').classList.remove('has-image');
    document.getElementById('attachedContent').style.display = 'none';
    uploadedImage = null; attachedContent = null; editingMemoId = null; selectedMemoTag = '일상';
    document.querySelectorAll('.tag-option').forEach(t => t.classList.toggle('active', t.dataset.tag === '일상'));
}

function selectMemoTag(el) { document.querySelectorAll('.tag-option').forEach(t => t.classList.remove('active')); el.classList.add('active'); selectedMemoTag = el.dataset.tag; }

function handleImageUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { 
        uploadedImage = ev.target.result; 
        const area = document.getElementById('imageUploadArea'); 
        area.innerHTML = `<img src="${uploadedImage}"><input type="file" accept="image/*" onchange="handleImageUpload(event)" style="display:none;">`; 
        area.classList.add('has-image'); 
    };
    reader.readAsDataURL(file);
}

// Memo CRUD
function saveMemo(e) {
    e.preventDefault();
    const title = document.getElementById('memoTitle').value.trim();
    const content = document.getElementById('memoContent').value.trim();
    if (!content) return;
    
    const memos = getData(KEYS.memos);
    const memoData = { title: title || null, content, tag: selectedMemoTag, image: uploadedImage, attachment: attachedContent, date: getToday(), timestamp: new Date().toISOString() };
    
    if (editingMemoId) { 
        const idx = memos.findIndex(m => m.id === editingMemoId); 
        if (idx >= 0) memos[idx] = { ...memos[idx], ...memoData }; 
    } else { 
        memoData.id = Date.now(); 
        memos.unshift(memoData); 
    }
    
    setData(KEYS.memos, memos);
    closeModal('addMemoModal');
    renderMemos();
}

function renderMemos() {
    const memos = getData(KEYS.memos);
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filtered = memos.filter(m => m.content.toLowerCase().includes(search) || (m.title && m.title.toLowerCase().includes(search)));
    const container = document.getElementById('memoViewContainer');
    
    if (currentViewMode === 'calendar') { 
        renderCalendarView(container, filtered); 
        return; 
    }
    
    const memoContainer = document.getElementById('memoContainer');
    memoContainer.className = `cards-compact ${currentViewMode === 'list' ? 'list-view' : ''}`;
    
    if (filtered.length === 0) { 
        memoContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">아직 메모가 없어요</div></div>'; 
        container.innerHTML = ''; 
        container.appendChild(memoContainer); 
        return; 
    }
    
    memoContainer.innerHTML = filtered.map(m => {
        let att = '';
        if (m.attachment) {
            att = `<div class="card-attachment"><div class="card-attachment-thumb">${m.attachment.image ? `<img src="${m.attachment.image}">` : getTypeIcon(m.attachment.type)}</div><div class="card-attachment-info"><div class="card-attachment-title">${escapeHtml(m.attachment.title)}</div><div class="card-attachment-type">${getTypeName(m.attachment.type)}</div></div></div>`;
        }
        return `<div class="card-mini" onclick="viewMemo(${m.id})">${m.image ? `<div class="card-image-placeholder"><img src="${m.image}"></div>` : ''}<div class="card-content-wrapper">${m.title ? `<div class="card-title">${escapeHtml(m.title)}</div>` : ''}<div class="card-date">${formatDate(m.timestamp)}</div><div class="card-content-text">${escapeHtml(m.content)}</div><span class="card-tag">${m.tag}</span>${att}</div></div>`;
    }).join('');
    
    container.innerHTML = '';
    container.appendChild(memoContainer);
}

function renderCalendarView(container, memos) {
    const y = calendarDate.getFullYear(), m = calendarDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay(), lastDate = new Date(y, m + 1, 0).getDate();
    const today = getToday();
    
    const memosByDate = {}, emotionsByDate = {};
    const emotions = getData(KEYS.emotions);
    memos.forEach(memo => { if (!memosByDate[memo.date]) memosByDate[memo.date] = []; memosByDate[memo.date].push(memo); });
    emotions.forEach(e => { if (!emotionsByDate[e.date]) emotionsByDate[e.date] = []; emotionsByDate[e.date].push(e); });
    
    const emojiMap = {1: '😊', 2: '🙂', 3: '😐', 4: '😔', 5: '😢'};
    
    let html = `<div class="calendar-container"><div class="calendar-header"><button onclick="prevMonthView()">◀</button><span class="calendar-title">${y}년 ${m + 1}월</span><button onclick="nextMonthView()">▶</button></div><div class="calendar-grid">${['일','월','화','수','목','금','토'].map(d => `<div class="cal-weekday">${d}</div>`).join('')}`;
    
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
    
    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayMemos = memosByDate[dateStr] || [];
        const dayEmotions = emotionsByDate[dateStr] || [];
        const isToday = dateStr === today;
        const isSelected = dateStr === selectedCalendarDate;
        const latestEmotion = dayEmotions.length > 0 ? dayEmotions[dayEmotions.length - 1] : null;
        
        html += `<div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectCalendarDate('${dateStr}')"><div class="cal-day-number">${d}</div>${latestEmotion ? `<div class="cal-day-emotion">${emojiMap[latestEmotion.level]}</div>` : ''}${dayMemos.length > 0 ? `<div class="cal-day-memo">${escapeHtml(dayMemos[0].content.substring(0, 20))}</div>` : ''}${dayMemos.length > 1 ? `<div class="cal-day-dots">${dayMemos.slice(1, 4).map(() => '<div class="cal-day-dot"></div>').join('')}</div>` : ''}</div>`;
    }
    
    html += '</div>';
    
    if (selectedCalendarDate && memosByDate[selectedCalendarDate]) {
        const selectedMemos = memosByDate[selectedCalendarDate];
        html += `<div class="selected-day-memos"><div class="selected-day-title">${selectedCalendarDate} 메모 (${selectedMemos.length}개)</div><div class="selected-day-list">${selectedMemos.map(m => `<div class="card-mini" onclick="viewMemo(${m.id})"><div class="card-content-wrapper">${m.title ? `<div class="card-title">${escapeHtml(m.title)}</div>` : ''}<div class="card-date">${formatDate(m.timestamp)}</div><div class="card-content-text">${escapeHtml(m.content)}</div><span class="card-tag">${m.tag}</span></div></div>`).join('')}</div></div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function selectCalendarDate(dateStr) { selectedCalendarDate = selectedCalendarDate === dateStr ? null : dateStr; renderMemos(); }
function prevMonthView() { calendarDate.setMonth(calendarDate.getMonth() - 1); renderMemos(); }
function nextMonthView() { calendarDate.setMonth(calendarDate.getMonth() + 1); renderMemos(); }

function viewMemo(id) {
    const memo = getData(KEYS.memos).find(m => m.id === id);
    if (!memo) return;
    
    let attHtml = '';
    if (memo.attachment) {
        attHtml = `<div class="detail-attachment"><div style="display: flex; align-items: center; gap: 0.75rem;"><div style="width: 50px; height: 70px; background: var(--border-light); border-radius: 4px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${memo.attachment.image ? `<img src="${memo.attachment.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-size: 1.5rem;">${getTypeIcon(memo.attachment.type)}</span>`}</div><div><div style="font-weight: 500; margin-bottom: 0.25rem;">${memo.attachment.title}</div><div style="font-size: 0.75rem; color: var(--text-secondary);">${memo.attachment.author || memo.attachment.director || memo.attachment.address || getTypeName(memo.attachment.type)}</div></div></div></div>`;
    }
    
    document.getElementById('detailContent').innerHTML = `${memo.image ? `<img src="${memo.image}" class="detail-image">` : ''}${memo.title ? `<div class="detail-title">${escapeHtml(memo.title)}</div>` : ''}<div class="detail-meta"><span>${formatDate(memo.timestamp)}</span><span>${memo.tag}</span></div><div class="detail-content">${escapeHtml(memo.content)}</div>${attHtml}<div class="detail-actions"><button class="detail-btn edit" onclick="editMemo(${memo.id})">수정</button><button class="detail-btn delete" onclick="deleteMemo(${memo.id})">삭제</button></div>`;
    openModal('viewDetailModal');
}

function editMemo(id) {
    const memo = getData(KEYS.memos).find(m => m.id === id);
    if (!memo) return;
    closeModal('viewDetailModal');
    
    document.getElementById('memoModalTitle').textContent = '메모 수정';
    document.getElementById('memoTitle').value = memo.title || '';
    document.getElementById('memoContent').value = memo.content;
    document.getElementById('editMemoId').value = id;
    document.getElementById('memoSubmitBtn').textContent = '수정';
    
    selectedMemoTag = memo.tag;
    document.querySelectorAll('.tag-option').forEach(t => t.classList.toggle('active', t.dataset.tag === memo.tag));
    
    if (memo.image) {
        uploadedImage = memo.image;
        const area = document.getElementById('imageUploadArea');
        area.innerHTML = `<img src="${memo.image}"><input type="file" accept="image/*" onchange="handleImageUpload(event)" style="display:none;">`;
        area.classList.add('has-image');
    }
    
    if (memo.attachment) {
        attachedContent = memo.attachment;
        displayAttachment(memo.attachment);
    }
    
    editingMemoId = id;
    openModal('addMemoModal');
}

function deleteMemo(id) {
    if (!confirm('삭제할까요?')) return;
    setData(KEYS.memos, getData(KEYS.memos).filter(m => m.id !== id));
    closeModal('viewDetailModal');
    renderMemos();
}

function handleSearch() { renderMemos(); }

// Content Search (Naver API)
function openSearchModal() {
    isArchiveSearch = false;
    currentSearchType = 'book';
    document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.type === 'book'));
    document.getElementById('contentSearchInput').value = '';
    document.getElementById('searchResults').innerHTML = '<div class="search-empty">검색어를 입력하세요</div>';
    openModal('searchContentModal');
}

function selectSearchType(type) {
    currentSearchType = type;
    document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.type === type));
}

function handleSearchKeypress(e) { if (e.key === 'Enter') searchContent(); }

async function searchContent() {
    const query = document.getElementById('contentSearchInput').value.trim();
    if (!query) return;
    
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="search-loading">검색 중...</div>';
    
    try {
        const apiMap = { book: 'book.json', movie: 'movie.json', tv: 'movie.json', game: 'webkr.json', place: 'local.json' };
        const url = `https://openapi.naver.com/v1/search/${apiMap[currentSearchType]}?query=${encodeURIComponent(query)}&display=10`;
        
        const response = await fetch(CORS_PROXY + encodeURIComponent(url), {
            headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET }
        });
        
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            resultsContainer.innerHTML = '<div class="search-empty">검색 결과가 없습니다</div>';
            return;
        }
        
        resultsContainer.innerHTML = data.items.map(item => {
            const title = item.title.replace(/<[^>]*>/g, '');
            let meta = '', thumb = '';
            if (currentSearchType === 'book') { meta = item.author || ''; thumb = item.image || ''; }
            else if (currentSearchType === 'movie' || currentSearchType === 'tv') { meta = item.director ? item.director.replace(/\|/g, ', ').slice(0, -2) : ''; thumb = item.image || ''; }
            else if (currentSearchType === 'place') { meta = item.address || item.roadAddress || ''; }
            else { meta = item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 50) : ''; }
            
            const itemData = JSON.stringify({ type: currentSearchType, title, author: item.author || null, director: item.director ? item.director.replace(/\|/g, ', ').slice(0, -2) : null, address: item.address || item.roadAddress || null, image: thumb || null }).replace(/"/g, '&quot;');
            
            return `<div class="search-result-item" onclick='selectSearchResult(${itemData})'><div class="search-result-thumb">${thumb ? `<img src="${thumb}">` : getTypeIcon(currentSearchType)}</div><div class="search-result-info"><div class="search-result-title">${title}</div><div class="search-result-meta">${meta}</div></div></div>`;
        }).join('');
        
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<div class="search-empty">검색 중 오류가 발생했습니다.<br><small style="color: #999;">CORS 제한으로 인해 로컬에서는 작동하지 않을 수 있습니다.</small></div>';
    }
}

function selectSearchResult(item) {
    if (isArchiveSearch) {
        document.getElementById('archiveTitle').value = item.title;
        document.getElementById('archiveImage').value = item.image || '';
        document.getElementById('archiveAuthor').value = item.author || '';
        document.getElementById('archiveDirector').value = item.director || '';
        document.getElementById('archiveAddress').value = item.address || '';
        
        const resultDiv = document.getElementById('archiveSearchResult');
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `<div class="attached-content"><div class="attached-content-thumb">${item.image ? `<img src="${item.image}">` : getTypeIcon(item.type)}</div><div class="attached-content-info"><div class="attached-content-title">${item.title}</div><div class="attached-content-meta">${item.author || item.director || item.address || getTypeName(item.type)}</div></div></div>`;
    } else {
        attachedContent = item;
        displayAttachment(item);
    }
    closeModal('searchContentModal');
}

function displayAttachment(item) {
    const container = document.getElementById('attachedContent');
    document.getElementById('attachedThumb').innerHTML = item.image ? `<img src="${item.image}">` : getTypeIcon(item.type);
    document.getElementById('attachedTitle').textContent = item.title;
    document.getElementById('attachedMeta').textContent = item.author || item.director || item.address || getTypeName(item.type);
    container.style.display = 'flex';
}

function removeAttachment() { attachedContent = null; document.getElementById('attachedContent').style.display = 'none'; }

// Archive
function selectArchiveType(type) {
    document.querySelectorAll('.archive-tab').forEach(t => t.classList.toggle('active', t.dataset.type === type));
    currentArchiveType = type;
    renderArchives();
}

function selectArchiveTypeModal(el) {
    document.querySelectorAll('.archive-type-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    selectedArchiveTypeModal = el.dataset.type;
}

function openArchiveSearchModal() {
    isArchiveSearch = true;
    currentSearchType = selectedArchiveTypeModal;
    document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.type === selectedArchiveTypeModal));
    document.getElementById('contentSearchInput').value = '';
    document.getElementById('searchResults').innerHTML = '<div class="search-empty">검색어를 입력하세요</div>';
    openModal('searchContentModal');
}

function saveArchive(e) {
    e.preventDefault();
    const title = document.getElementById('archiveTitle').value.trim();
    const note = document.getElementById('archiveNote').value.trim();
    if (!title) return;
    
    const archives = getData(KEYS.archives);
    archives.unshift({
        id: Date.now(), title, note: note || null, type: selectedArchiveTypeModal,
        image: document.getElementById('archiveImage').value || null,
        author: document.getElementById('archiveAuthor').value || null,
        director: document.getElementById('archiveDirector').value || null,
        address: document.getElementById('archiveAddress').value || null,
        date: getToday(), timestamp: new Date().toISOString()
    });
    
    setData(KEYS.archives, archives);
    closeModal('addArchiveModal');
    document.getElementById('archiveTitle').value = '';
    document.getElementById('archiveNote').value = '';
    document.getElementById('archiveImage').value = '';
    document.getElementById('archiveSearchResult').style.display = 'none';
    renderArchives();
}

function renderArchives() {
    const archives = getData(KEYS.archives).filter(a => a.type === currentArchiveType);
    const container = document.getElementById('archiveList');
    
    if (archives.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">${getTypeIcon(currentArchiveType)}</div><div class="empty-text">아직 기록이 없어요</div></div>`;
        return;
    }
    
    container.innerHTML = archives.map(a => `<div class="archive-item"><div class="archive-item-thumb">${a.image ? `<img src="${a.image}">` : getTypeIcon(a.type)}</div><div class="archive-item-info"><div class="archive-item-title">${escapeHtml(a.title)}</div><div class="archive-item-meta">${a.author || a.director || a.address || ''}</div><div class="archive-item-date">${formatDate(a.timestamp)}</div></div><button class="archive-item-delete" onclick="deleteArchive(${a.id})">×</button></div>`).join('');
}

function deleteArchive(id) {
    if (!confirm('삭제할까요?')) return;
    setData(KEYS.archives, getData(KEYS.archives).filter(a => a.id !== id));
    renderArchives();
}

// Emotion
function setEmotion(level) {
    const hour = parseInt(document.getElementById('emotionHour').value);
    const minute = parseInt(document.getElementById('emotionMinute').value);
    const timeStr = `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`;
    
    const emotions = getData(KEYS.emotions);
    emotions.push({ id: Date.now(), date: getToday(), time: timeStr, level, timestamp: new Date().toISOString() });
    setData(KEYS.emotions, emotions);
    
    document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`.emotion-btn[data-level="${level}"]`).classList.add('selected');
    setTimeout(() => document.querySelector(`.emotion-btn[data-level="${level}"]`).classList.remove('selected'), 500);
    
    loadTodayEmotions();
    renderEmotionGraph();
}

function loadTodayEmotions() {
    const today = getToday();
    const emotions = getData(KEYS.emotions).filter(e => e.date === today);
    const container = document.getElementById('emotionHistoryContainer');
    
    if (emotions.length === 0) { container.innerHTML = ''; return; }
    
    const emojiMap = {1: '😊', 2: '🙂', 3: '😐', 4: '😔', 5: '😢'};
    container.innerHTML = `<div class="emotion-history"><div class="emotion-history-title">오늘 기록한 감정 (${emotions.length}개)</div><div class="emotion-history-list">${emotions.sort((a,b) => a.time.localeCompare(b.time)).map(e => `<div class="emotion-history-item"><span class="emotion-history-time">${e.time}</span><span class="emotion-history-emoji">${emojiMap[e.level]}</span><button class="emotion-history-delete" onclick="deleteEmotion(${e.id})">×</button></div>`).join('')}</div></div>`;
}

function deleteEmotion(id) {
    if (!confirm('삭제할까요?')) return;
    setData(KEYS.emotions, getData(KEYS.emotions).filter(e => e.id !== id));
    loadTodayEmotions();
    renderEmotionGraph();
}

function openGraphSettings() { openModal('graphSettingsModal'); }

function renderEmotionGraph() {
    const period = parseInt(document.getElementById('graphPeriod')?.value || 14);
    const style = document.getElementById('graphStyle')?.value || 'line';
    const emotions = getData(KEYS.emotions);
    
    const days = [];
    for (let i = period - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().split('T')[0]); }
    
    const dailyData = days.map(day => {
        const dayEmotions = emotions.filter(e => e.date === day);
        if (dayEmotions.length === 0) return null;
        return dayEmotions.reduce((s, e) => s + e.level, 0) / dayEmotions.length;
    });
    
    const container = document.getElementById('emotionLineChart');
    const width = container.offsetWidth || 300, height = 120;
    const padding = { top: 10, right: 10, bottom: 25, left: 10 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    
    if (style === 'line') {
        const points = dailyData.map((val, i) => {
            if (val === null) return null;
            return { x: padding.left + (i / (days.length - 1)) * graphWidth, y: padding.top + ((val - 1) / 4) * graphHeight, val };
        }).filter(p => p !== null);
        
        let pathD = '';
        points.forEach((p, i) => { pathD += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`; });
        
        container.innerHTML = `<svg width="${width}" height="${height}">${[0, 0.25, 0.5, 0.75, 1].map(p => `<line x1="${padding.left}" y1="${padding.top + p * graphHeight}" x2="${width - padding.right}" y2="${padding.top + p * graphHeight}" stroke="#E8E8E8" stroke-width="1"/>`).join('')}<path d="${pathD}" fill="none" stroke="url(#lineGradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="#B1D9D4" stroke-width="2"/>`).join('')}<defs><linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#4ADE80"/><stop offset="50%" style="stop-color:#FACC15"/><stop offset="100%" style="stop-color:#F87171"/></linearGradient></defs></svg><div class="emotion-x-labels">${days.filter((_, i) => i % Math.ceil(period / 7) === 0 || i === days.length - 1).map(d => { const date = new Date(d); return `<span>${date.getMonth()+1}/${date.getDate()}</span>`; }).join('')}</div>`;
    } else {
        const barWidth = graphWidth / days.length * 0.7;
        const barGap = graphWidth / days.length * 0.3;
        const colors = ['#4ADE80', '#A3E635', '#FACC15', '#FB923C', '#F87171'];
        
        container.innerHTML = `<svg width="${width}" height="${height}">${dailyData.map((val, i) => { if (val === null) return ''; const x = padding.left + i * (barWidth + barGap); const barHeight = ((6 - val) / 5) * graphHeight; const y = padding.top + graphHeight - barHeight; return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${colors[Math.round(val) - 1] || '#B1D9D4'}" rx="2"/>`; }).join('')}</svg><div class="emotion-x-labels">${days.filter((_, i) => i % Math.ceil(period / 7) === 0 || i === days.length - 1).map(d => { const date = new Date(d); return `<span>${date.getMonth()+1}/${date.getDate()}</span>`; }).join('')}</div>`;
    }
}

function updateEmotionGraph() { renderEmotionGraph(); }

// Lab Tabs
function selectLabTab(tab) {
    document.querySelectorAll('.lab-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.lab-tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    if (tab === 'emotion') renderEmotionGraph();
}

// Timer
function toggleTimer() {
    if (isTimerRunning) { clearInterval(timerInterval); document.getElementById('timerStartBtn').textContent = '계속'; }
    else { timerInterval = setInterval(updateTimer, 1000); document.getElementById('timerStartBtn').textContent = '일시정지'; }
    isTimerRunning = !isTimerRunning;
}

function updateTimer() {
    if (timerSeconds <= 0) {
        clearInterval(timerInterval); isTimerRunning = false;
        if (!isBreakTime) {
            const focus = getData(KEYS.focus); focus.push({ date: getToday(), duration: 25, timestamp: new Date().toISOString() }); setData(KEYS.focus, focus); updateFocusStats();
            isBreakTime = true; timerSeconds = 5 * 60; document.getElementById('timerLabel').textContent = '휴식 시간'; alert('집중 시간 완료! 5분 휴식하세요.');
        } else { isBreakTime = false; timerSeconds = 25 * 60; document.getElementById('timerLabel').textContent = '집중 시간'; alert('휴식 끝! 다시 집중해볼까요?'); }
        document.getElementById('timerStartBtn').textContent = '시작'; updateTimerDisplay(); return;
    }
    timerSeconds--; updateTimerDisplay();
}

function updateTimerDisplay() { document.getElementById('timerDisplay').textContent = `${Math.floor(timerSeconds/60).toString().padStart(2,'0')}:${(timerSeconds%60).toString().padStart(2,'0')}`; }
function resetTimer() { clearInterval(timerInterval); isTimerRunning = false; isBreakTime = false; timerSeconds = 25 * 60; document.getElementById('timerStartBtn').textContent = '시작'; document.getElementById('timerLabel').textContent = '집중 시간'; updateTimerDisplay(); }
function updateFocusStats() { const focus = getData(KEYS.focus).filter(f => f.date === getToday()); document.getElementById('todayFocusTime').textContent = `${focus.reduce((s, f) => s + f.duration, 0)}분`; document.getElementById('todayFocusCount').textContent = `${focus.length}회 완료`; }

// Report
function selectPeriod(period) { document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === period)); selectedPeriod = period; updateReport(); }

function updateReport() {
    const memos = getData(KEYS.memos), emotions = getData(KEYS.emotions), archives = getData(KEYS.archives);
    let startDate = new Date(), periodLabel = '';
    const todayStr = getToday();
    
    if (selectedPeriod === 'daily') periodLabel = '오늘 작성한 기록';
    else if (selectedPeriod === 'weekly') { startDate.setDate(startDate.getDate() - 7); periodLabel = '이번 주 작성한 기록'; }
    else { startDate.setMonth(startDate.getMonth() - 1); periodLabel = '이번 달 작성한 기록'; }
    
    const startStr = startDate.toISOString().split('T')[0];
    const fMemos = selectedPeriod === 'daily' ? memos.filter(m => m.date === todayStr) : memos.filter(m => m.date >= startStr);
    const fEmotions = selectedPeriod === 'daily' ? emotions.filter(e => e.date === todayStr) : emotions.filter(e => e.date >= startStr);
    const fArchives = selectedPeriod === 'daily' ? archives.filter(a => a.date === todayStr) : archives.filter(a => a.date >= startStr);
    
    document.getElementById('reportTotal').textContent = `${fMemos.length + fArchives.length}개`;
    document.getElementById('reportPeriodLabel').textContent = periodLabel;
    
    if (fEmotions.length > 0) {
        const avg = fEmotions.reduce((s, e) => s + e.level, 0) / fEmotions.length;
        const labels = ['', '😊 아주 좋음', '🙂 좋음', '😐 보통', '😔 별로', '😢 안좋음'];
        document.getElementById('reportEmotion').textContent = labels[Math.round(avg)];
        document.getElementById('reportEmotionDesc').textContent = `평균 ${avg.toFixed(1)}점 (${fEmotions.length}회)`;
    } else { document.getElementById('reportEmotion').textContent = '-'; document.getElementById('reportEmotionDesc').textContent = '기록된 감정이 없어요'; }
    
    const tagCounts = {}; fMemos.forEach(m => tagCounts[m.tag] = (tagCounts[m.tag] || 0) + 1);
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    document.getElementById('reportTags').innerHTML = sortedTags.length > 0 ? sortedTags.map((t, i) => `<span class="keyword-tag ${i === 0 ? 'highlight' : ''}">${t[0]} (${t[1]})</span>`).join('') : '<span class="keyword-tag">아직 데이터가 없어요</span>';
    
    const books = fArchives.filter(a => a.type === 'book').length, movies = fArchives.filter(a => a.type === 'movie').length, tvs = fArchives.filter(a => a.type === 'tv').length;
    document.getElementById('reportContents').textContent = `${fArchives.length}개`;
    document.getElementById('reportContentsDetail').textContent = `책 ${books} · 영화 ${movies} · TV ${tvs}`;
}

// Export
function openExportModal() { document.getElementById('exportContent').value = generateClaudePrompt(); openModal('exportModal'); }

function generateClaudePrompt() {
    const memos = getData(KEYS.memos), emotions = getData(KEYS.emotions), archives = getData(KEYS.archives);
    let startDate = new Date(), periodName = '';
    const todayStr = getToday();
    
    if (selectedPeriod === 'daily') periodName = '오늘';
    else if (selectedPeriod === 'weekly') { startDate.setDate(startDate.getDate() - 7); periodName = '이번 주'; }
    else { startDate.setMonth(startDate.getMonth() - 1); periodName = '이번 달'; }
    
    const startStr = startDate.toISOString().split('T')[0];
    const fMemos = selectedPeriod === 'daily' ? memos.filter(m => m.date === todayStr) : memos.filter(m => m.date >= startStr);
    const fEmotions = selectedPeriod === 'daily' ? emotions.filter(e => e.date === todayStr) : emotions.filter(e => e.date >= startStr);
    const fArchives = selectedPeriod === 'daily' ? archives.filter(a => a.date === todayStr) : archives.filter(a => a.date >= startStr);
    
    let prompt = `당신은 개인 기록 분석 전문가입니다. 아래는 제가 ${periodName} 기록한 데이터입니다. 분석해서 인사이트를 제공해주세요.\n\n## 분석 요청\n1. 전반적인 감정 상태와 흐름\n2. 주요 관심사나 생각 패턴\n3. 소비한 콘텐츠에서 보이는 취향\n4. 개선하거나 주의할 점\n5. 격려 메시지\n\n---\n\n## 📊 기록 데이터\n\n### 감정 기록 (1=아주좋음 ~ 5=안좋음)\n`;
    
    if (fEmotions.length > 0) {
        const labels = ['', '😊아주좋음', '🙂좋음', '😐보통', '😔별로', '😢안좋음'];
        fEmotions.forEach(e => prompt += `- ${e.date} ${e.time || ''}: ${labels[e.level]}\n`);
    } else prompt += `기록 없음\n`;
    
    prompt += `\n### 메모/일기\n`;
    if (fMemos.length > 0) { fMemos.forEach(m => { prompt += `- [${m.date}] [${m.tag}] ${m.title ? m.title + ': ' : ''}${m.content}\n`; if (m.attachment) prompt += `  └ 첨부: ${getTypeName(m.attachment.type)} - ${m.attachment.title}\n`; }); } else prompt += `기록 없음\n`;
    
    prompt += `\n### 소비한 콘텐츠\n`;
    if (fArchives.length > 0) { const types = { book: '책', movie: '영화', tv: 'TV', game: '게임', place: '장소' }; fArchives.forEach(a => prompt += `- [${types[a.type]}] ${a.title} (${a.date})${a.note ? ' - ' + a.note : ''}\n`); } else prompt += `기록 없음\n`;
    
    return prompt + `\n---\n\n위 데이터를 바탕으로 ${periodName}의 저에 대해 친근하고 따뜻한 톤으로 분석해주세요.`;
}

function copyExport() { document.getElementById('exportContent').select(); document.execCommand('copy'); document.getElementById('copySuccess').style.display = 'block'; setTimeout(() => document.getElementById('copySuccess').style.display = 'none', 2000); }

// Data Management
function exportData() {
    const data = { memos: getData(KEYS.memos), emotions: getData(KEYS.emotions), archives: getData(KEYS.archives), focus: getData(KEYS.focus), exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `minimi_backup_${getToday()}.json`; a.click();
}

function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (data.memos) setData(KEYS.memos, data.memos); if (data.emotions) setData(KEYS.emotions, data.emotions); if (data.archives) setData(KEYS.archives, data.archives); if (data.focus) setData(KEYS.focus, data.focus); alert('데이터를 성공적으로 가져왔습니다!'); init(); } catch (err) { alert('파일 읽기 오류: ' + err.message); } };
    reader.readAsText(file);
}

function clearAllData() { if (!confirm('정말 모든 데이터를 삭제할까요?')) return; if (!confirm('마지막 확인입니다. 삭제할까요?')) return; Object.values(KEYS).forEach(k => localStorage.removeItem(k)); alert('모든 데이터가 삭제되었습니다.'); init(); }

document.addEventListener('DOMContentLoaded', init);

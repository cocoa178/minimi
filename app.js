// Constants & Helpers
const KEYS = { memos: 'minimi_memos', emotions: 'minimi_emotions', archives: 'minimi_archives', focus: 'minimi_focus', todos: 'minimi_todos', events: 'minimi_events' };
const NAVER_CLIENT_ID = 'vWmfW76p6UDTgqnMI2kI';
const NAVER_CLIENT_SECRET = 'd9Lv90JLJS';
const CORS_PROXY = 'https://corsproxy.io/?';

const getData = key => JSON.parse(localStorage.getItem(key) || '[]');
const setData = (key, data) => localStorage.setItem(key, JSON.stringify(data));
const getToday = () => new Date().toISOString().split('T')[0];
const formatDate = iso => { const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}시`; };
const escapeHtml = text => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };
const getTypeIcon = type => ({ book: '📚', movie: '🎬', tv: '📺', music: '🎵', place: '📍' }[type] || '📄');
const getTypeName = type => ({ book: '책', movie: '영화', tv: '드라마', music: '음악', place: '장소' }[type] || '기타');
const emojiMap = {1: '😢', 2: '😔', 3: '😐', 4: '🙂', 5: '😊'};

// Event Colors (스크린샷 기반)
const eventColors = [
    '#0F0F12', '#FF6B6B', '#FF8787', '#FFA8A8', '#F783AC', '#DA77F2', '#9775FA', '#748FFC',
    '#4DABF7', '#38D9A9', '#69DB7C', '#A9E34B', '#FFD43B', '#FFA94D', '#FF8A65', '#A1887F', '#ADB5BD',
    '#868E96', '#5C7CFA', '#20C997'
];
let selectedEventColor = '#0F0F12';

// State
let currentPage = 'memo', currentViewMode = 'masonry', isCalendarMode = false;
let memoCalendarDate = new Date(), selectedMemoDate = getToday();
let currentArchiveTab = 'content', currentContentType = 'book', contentCalendarDate = new Date();
let selectedMemoTag = '일상', selectedArchiveTypeModal = 'book';
let uploadedImage = null, attachedContent = null, editingMemoId = null;
let selectedPeriod = 'daily', currentSearchType = 'book', isArchiveSearch = false;
let timerInterval = null, timerSeconds = 25 * 60, isTimerRunning = false, isBreakTime = false;
let emotionTableDate = new Date();

// Initialize
function init() {
    updateEmotionDateDisplay();
    updateViewIcon();
    updateHeaderVisibility();
    renderMemos();
    renderArchiveCategories();
    renderEmotionGraph();
    renderEmotionInputTable();
    updateReport();
    updateFocusStats();
}

// Header Visibility
function updateHeaderVisibility() {
    document.querySelectorAll('.memo-only').forEach(el => {
        el.style.display = currentPage === 'memo' ? '' : 'none';
    });
}

// View Mode
function updateViewIcon() {
    const icon = document.getElementById('viewToggleIcon');
    icon.className = 'view-toggle-icon memo-only';
    if (currentViewMode === 'grid') icon.classList.add('grid-icon');
    else if (currentViewMode === 'list') icon.classList.add('list-icon');
    
    if (currentViewMode === 'grid') {
        icon.innerHTML = '<span></span><span></span><span></span><span></span>';
    } else if (currentViewMode === 'list') {
        icon.innerHTML = '<span></span><span></span><span></span>';
    } else {
        icon.innerHTML = '<span></span><span></span>';
    }
}

function cycleViewMode() {
    const modes = ['masonry', 'grid', 'list'];
    const idx = modes.indexOf(currentViewMode);
    currentViewMode = modes[(idx + 1) % modes.length];
    updateViewIcon();
    renderMemos();
}

// Calendar Mode Toggle
function toggleCalendarMode() {
    isCalendarMode = !isCalendarMode;
    document.getElementById('memoNormalView').style.display = isCalendarMode ? 'none' : 'block';
    document.getElementById('memoCalendarView').classList.toggle('active', isCalendarMode);
    if (isCalendarMode) {
        renderMemoCalendar();
        renderSelectedDayInfo();
    }
}

// Navigation
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    currentPage = page;
    updateHeaderVisibility();
    if (page === 'archive') renderArchiveCategories();
    if (page === 'lab') { updateReport(); renderEmotionGraph(); renderEmotionInputTable(); }
}

function toggleMenu() { document.getElementById('menuOverlay').classList.toggle('active'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function openAddModal() {
    if (currentPage === 'archive' && currentArchiveTab === 'content') { 
        renderArchiveTypeGrid();
        openModal('addArchiveModal'); 
    } else if (currentPage === 'archive' && currentArchiveTab === 'place') {
        selectedArchiveTypeModal = 'place';
        renderArchiveTypeGrid();
        openModal('addArchiveModal');
    } else { 
        resetMemoModal(); 
        openModal('addMemoModal'); 
    }
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

// Memo Calendar
function renderMemoCalendar() {
    const y = memoCalendarDate.getFullYear(), m = memoCalendarDate.getMonth();
    document.getElementById('memoCalendarTitle').textContent = `${y}년 ${m + 1}월`;
    
    const firstDay = new Date(y, m, 1).getDay(), lastDate = new Date(y, m + 1, 0).getDate();
    const memos = getData(KEYS.memos);
    const events = getData(KEYS.events);
    
    const memosByDate = {};
    memos.forEach(memo => { if (!memosByDate[memo.date]) memosByDate[memo.date] = []; memosByDate[memo.date].push(memo); });
    
    const eventsByDate = {};
    events.forEach(ev => { if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []; eventsByDate[ev.date].push(ev); });
    
    const today = getToday();
    let html = ['일','월','화','수','목','금','토'].map(d => `<div class="daily-cal-weekday">${d}</div>`).join('');
    
    for (let i = 0; i < firstDay; i++) html += '<div class="daily-cal-day empty"></div>';
    
    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const hasMemo = memosByDate[dateStr] && memosByDate[dateStr].length > 0;
        const dayEvents = eventsByDate[dateStr] || [];
        const isToday = dateStr === today;
        const isSelected = dateStr === selectedMemoDate;
        
        let eventDots = '';
        if (dayEvents.length > 0) {
            eventDots = '<div class="cal-event-dots">' + dayEvents.slice(0, 3).map(ev => 
                `<span class="cal-event-dot" style="background:${ev.color}"></span>`
            ).join('') + '</div>';
        }
        
        html += `<div class="daily-cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasMemo ? 'has-memo' : ''}" onclick="selectMemoDate('${dateStr}')"><span class="cal-day-num">${d}</span>${eventDots}</div>`;
    }
    
    document.getElementById('memoCalendarGrid').innerHTML = html;
}

function selectMemoDate(dateStr) {
    selectedMemoDate = dateStr;
    renderMemoCalendar();
    renderSelectedDayInfo();
}

function prevMemoMonth() { memoCalendarDate.setMonth(memoCalendarDate.getMonth() - 1); renderMemoCalendar(); }
function nextMemoMonth() { memoCalendarDate.setMonth(memoCalendarDate.getMonth() + 1); renderMemoCalendar(); }

function renderSelectedDayInfo() {
    const dateObj = new Date(selectedMemoDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    document.getElementById('selectedDateHeader').textContent = `${dateObj.getFullYear()}년 ${dateObj.getMonth()+1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;
    
    // 일정 렌더링
    renderDayEvents();
    
    // 투두리스트
    renderTodos();
    
    // 해당 날짜 메모
    const memos = getData(KEYS.memos).filter(m => m.date === selectedMemoDate);
    const container = document.getElementById('dailyMemosContainer');
    if (memos.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:1rem;font-size:0.85rem;">이 날의 메모가 없어요</div>';
    } else {
        container.innerHTML = memos.map(m => `<div class="card-mini" onclick="viewMemo(${m.id})">${m.image ? `<div class="card-image-placeholder"><img src="${m.image}"></div>` : ''}<div class="card-content-wrapper">${m.title ? `<div class="card-title">${escapeHtml(m.title)}</div>` : ''}<div class="card-date">${formatDate(m.timestamp)}</div><div class="card-content-text">${escapeHtml(m.content)}</div><span class="card-tag">${m.tag}</span></div></div>`).join('');
    }
}

// Event (일정) Functions
function renderDayEvents() {
    const events = getData(KEYS.events).filter(e => e.date === selectedMemoDate);
    const container = document.getElementById('dailyEventsSection');
    
    if (events.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = events.map(e => {
        const timeText = e.allDay ? '하루 종일' : `${e.startTime || ''} ~ ${e.endTime || ''}`;
        return `
            <div class="daily-event-item" onclick="editEvent(${e.id})">
                <div class="event-color-dot" style="background:${e.color}"></div>
                <div class="event-info">
                    <div class="event-title-text">${escapeHtml(e.title)}</div>
                    <div class="event-time-text">${timeText}</div>
                </div>
                <button class="event-delete-btn" onclick="event.stopPropagation();deleteEvent(${e.id})">×</button>
            </div>
        `;
    }).join('');
}

function openEventModal(eventId = null) {
    selectedEventColor = '#0F0F12';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventMemo').value = '';
    document.getElementById('eventAllDay').checked = false;
    document.getElementById('editEventId').value = '';
    
    // 날짜 표시
    const dateObj = new Date(selectedMemoDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    document.getElementById('eventDateDisplay').textContent = `${dateObj.getMonth()+1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;
    
    // 시간 select 채우기
    const startSelect = document.getElementById('eventStartHour');
    const endSelect = document.getElementById('eventEndHour');
    startSelect.innerHTML = '<option value="">시작</option>';
    endSelect.innerHTML = '<option value="">종료</option>';
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const timeStr = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
            startSelect.innerHTML += `<option value="${timeStr}">${timeStr}</option>`;
            endSelect.innerHTML += `<option value="${timeStr}">${timeStr}</option>`;
        }
    }
    
    // 색상 팔레트
    const palette = document.getElementById('colorPalette');
    palette.innerHTML = eventColors.map(c => 
        `<div class="color-option ${c === selectedEventColor ? 'selected' : ''}" style="background:${c}" onclick="selectEventColor('${c}')"></div>`
    ).join('');
    
    updateEventColorBar();
    toggleAllDay();
    openModal('addEventModal');
}

function selectEventColor(color) {
    selectedEventColor = color;
    document.querySelectorAll('.color-option').forEach(el => {
        el.classList.toggle('selected', el.style.background === color || el.style.backgroundColor === color);
    });
    updateEventColorBar();
}

function updateEventColorBar() {
    document.getElementById('eventColorBar').style.background = selectedEventColor;
}

function toggleAllDay() {
    const isAllDay = document.getElementById('eventAllDay').checked;
    document.getElementById('eventStartHour').disabled = isAllDay;
    document.getElementById('eventEndHour').disabled = isAllDay;
    if (isAllDay) {
        document.getElementById('eventStartHour').value = '';
        document.getElementById('eventEndHour').value = '';
    }
}

function saveEvent(e) {
    e.preventDefault();
    const title = document.getElementById('eventTitle').value.trim();
    if (!title) return;
    
    const events = getData(KEYS.events);
    const eventData = {
        title,
        date: selectedMemoDate,
        color: selectedEventColor,
        allDay: document.getElementById('eventAllDay').checked,
        startTime: document.getElementById('eventStartHour').value || null,
        endTime: document.getElementById('eventEndHour').value || null,
        memo: document.getElementById('eventMemo').value.trim() || null,
        timestamp: new Date().toISOString()
    };
    
    const editId = document.getElementById('editEventId').value;
    if (editId) {
        const idx = events.findIndex(ev => ev.id === parseInt(editId));
        if (idx >= 0) events[idx] = { ...events[idx], ...eventData };
    } else {
        eventData.id = Date.now();
        events.push(eventData);
    }
    
    setData(KEYS.events, events);
    closeModal('addEventModal');
    renderSelectedDayInfo();
    renderMemoCalendar();
}

function editEvent(id) {
    const ev = getData(KEYS.events).find(e => e.id === id);
    if (!ev) return;
    
    openEventModal();
    document.getElementById('eventTitle').value = ev.title;
    document.getElementById('eventMemo').value = ev.memo || '';
    document.getElementById('eventAllDay').checked = ev.allDay || false;
    document.getElementById('editEventId').value = id;
    
    if (ev.startTime) document.getElementById('eventStartHour').value = ev.startTime;
    if (ev.endTime) document.getElementById('eventEndHour').value = ev.endTime;
    
    selectEventColor(ev.color || '#0F0F12');
    toggleAllDay();
}

function deleteEvent(id) {
    if (!confirm('일정을 삭제할까요?')) return;
    setData(KEYS.events, getData(KEYS.events).filter(e => e.id !== id));
    renderSelectedDayInfo();
    renderMemoCalendar();
}

// Todo
function toggleTodoSection() {
    const content = document.getElementById('todoContent');
    const arrow = document.getElementById('todoArrow');
    content.classList.toggle('collapsed');
    arrow.classList.toggle('collapsed');
}

function handleTodoKeypress(e) { if (e.key === 'Enter') addTodo(); }

function addTodo() {
    const input = document.getElementById('todoInput');
    const text = input.value.trim();
    if (!text) return;
    
    const todos = getData(KEYS.todos);
    todos.push({ id: Date.now(), text, done: false, date: selectedMemoDate });
    setData(KEYS.todos, todos);
    input.value = '';
    renderTodos();
}

function renderTodos() {
    const todos = getData(KEYS.todos).filter(t => t.date === selectedMemoDate);
    const container = document.getElementById('todoList');
    
    if (todos.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:0.5rem;font-size:0.8rem;">할 일이 없어요</div>';
        return;
    }
    
    container.innerHTML = todos.map(t => `
        <div class="todo-item">
            <div class="todo-checkbox ${t.done ? 'checked' : ''}" onclick="toggleTodo(${t.id})">${t.done ? '✓' : ''}</div>
            <span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span>
            <button class="todo-delete" onclick="deleteTodo(${t.id})">×</button>
        </div>
    `).join('');
}

function toggleTodo(id) {
    const todos = getData(KEYS.todos);
    const idx = todos.findIndex(t => t.id === id);
    if (idx >= 0) { todos[idx].done = !todos[idx].done; setData(KEYS.todos, todos); renderTodos(); }
}

function deleteTodo(id) {
    setData(KEYS.todos, getData(KEYS.todos).filter(t => t.id !== id));
    renderTodos();
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
    
    if (attachedContent && !editingMemoId) {
        addToArchiveFromMemo(attachedContent, content, memoData.date);
    }
    
    closeModal('addMemoModal');
    renderMemos();
    renderArchiveCategories();
}

function addToArchiveFromMemo(attachment, memoContent, date) {
    const archives = getData(KEYS.archives);
    const exists = archives.some(a => a.title === attachment.title && a.date === date);
    if (exists) return;
    
    archives.unshift({
        id: Date.now(), title: attachment.title, note: memoContent.substring(0, 100),
        type: attachment.type, image: attachment.image || null,
        author: attachment.author || null, director: attachment.director || null,
        address: attachment.address || null, date: date, timestamp: new Date().toISOString(), fromMemo: true
    });
    setData(KEYS.archives, archives);
}

function renderMemos() {
    const memos = getData(KEYS.memos);
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filtered = memos.filter(m => m.content.toLowerCase().includes(search) || (m.title && m.title.toLowerCase().includes(search)));
    const container = document.getElementById('memoContainer');
    
    container.className = 'cards-compact';
    if (currentViewMode === 'grid') container.classList.add('grid-view');
    else if (currentViewMode === 'list') container.classList.add('list-view');
    
    if (filtered.length === 0) { 
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">아직 메모가 없어요</div></div>'; 
        return; 
    }
    
    container.innerHTML = filtered.map(m => {
        if (currentViewMode === 'grid') {
            if (!m.image) return '';
            return `<div class="card-mini grid-item" onclick="viewMemo(${m.id})"><div class="card-image-placeholder"><img src="${m.image}"></div></div>`;
        }
        return `<div class="card-mini" onclick="viewMemo(${m.id})">${m.image ? `<div class="card-image-placeholder"><img src="${m.image}"></div>` : ''}<div class="card-content-wrapper">${m.title ? `<div class="card-title">${escapeHtml(m.title)}</div>` : ''}<div class="card-date">${formatDate(m.timestamp)}</div><div class="card-content-text">${escapeHtml(m.content)}</div><span class="card-tag">${m.tag}</span></div></div>`;
    }).join('');
}

function handleSearch() { renderMemos(); }

function viewMemo(id) {
    const memo = getData(KEYS.memos).find(m => m.id === id);
    if (!memo) return;
    
    let attHtml = '';
    if (memo.attachment) {
        attHtml = `<div class="detail-attachment"><div style="display:flex;align-items:center;gap:0.75rem;"><div style="width:50px;height:70px;background:var(--border-light);border-radius:4px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${memo.attachment.image ? `<img src="${memo.attachment.image}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:1.5rem;">${getTypeIcon(memo.attachment.type)}</span>`}</div><div><div style="font-weight:500;margin-bottom:0.25rem;">${memo.attachment.title}</div><div style="font-size:0.75rem;color:var(--text-secondary);">${memo.attachment.author || memo.attachment.director || memo.attachment.address || getTypeName(memo.attachment.type)}</div></div></div></div>`;
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
    
    if (memo.attachment) { attachedContent = memo.attachment; displayAttachment(memo.attachment); }
    editingMemoId = id;
    openModal('addMemoModal');
}

function deleteMemo(id) {
    if (!confirm('삭제할까요?')) return;
    setData(KEYS.memos, getData(KEYS.memos).filter(m => m.id !== id));
    closeModal('viewDetailModal');
    renderMemos();
}
=${encodeURIComponent(query)}&display=10`;
        
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
        resultsContainer.innerHTML = '<div class="search-empty">검색 중 오류가 발생했습니다.</div>';
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

// Archive CRUD
function renderArchiveTypeGrid() {
    const grid = document.getElementById('archiveTypeGrid');
    if (currentArchiveTab === 'place') {
        grid.innerHTML = '<div class="archive-type-btn active" data-type="place"><div class="archive-type-icon">📍</div><div class="archive-type-label">장소</div></div>';
        selectedArchiveTypeModal = 'place';
    } else {
        const types = ['book', 'movie', 'tv', 'music'];
        const names = { book: '책', movie: '영화', tv: '드라마', music: '음악' };
        const icons = { book: '📚', movie: '🎬', tv: '📺', music: '🎵' };
        grid.innerHTML = types.map((t, i) => 
            `<div class="archive-type-btn ${i === 0 ? 'active' : ''}" data-type="${t}" onclick="selectArchiveTypeModal(this)"><div class="archive-type-icon">${icons[t]}</div><div class="archive-type-label">${names[t]}</div></div>`
        ).join('');
        selectedArchiveTypeModal = 'book';
    }
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
    renderArchiveCategories();
}

// Emotion
function updateEmotionDateDisplay() {
    const el = document.getElementById('emotionDateDisplay');
    if (el) {
        const y = emotionTableDate.getFullYear();
        const m = emotionTableDate.getMonth() + 1;
        const d = emotionTableDate.getDate();
        el.textContent = `${y}.${m.toString().padStart(2,'0')}.${d.toString().padStart(2,'0')}`;
    }
}

function changeEmotionDate(delta) {
    emotionTableDate.setDate(emotionTableDate.getDate() + delta);
    updateEmotionDateDisplay();
    renderEmotionInputTable();
}

function toggleSection(sectionId) {
    const content = document.getElementById(sectionId + 'Content');
    const arrow = document.getElementById(sectionId + 'Arrow');
    content.classList.toggle('closed');
    arrow.classList.toggle('collapsed');
}

function renderEmotionInputTable() {
    const dateStr = emotionTableDate.toISOString().split('T')[0];
    const emotions = getData(KEYS.emotions).filter(e => e.date === dateStr);
    const tbody = document.getElementById('emotionInputTableBody');
    if (!tbody) return;
    
    const byHour = {};
    emotions.forEach(e => {
        const hour = parseInt(e.time.split(':')[0]);
        if (!byHour[hour]) byHour[hour] = [];
        byHour[hour].push(e);
    });
    
    let html = '';
    for (let h = 0; h < 24; h++) {
        const existing = byHour[h] ? byHour[h][0] : null;
        const emotionValue = existing ? existing.level : 3;
        const reasonValue = existing ? (existing.reason || '') : '';
        
        html += `<tr data-hour="${h}">
            <td class="hour-cell">${h}시</td>
            <td class="slider-cell">
                <input type="range" min="1" max="5" value="${emotionValue}" 
                    class="emotion-row-slider" data-hour="${h}" oninput="updateRowEmoji(this)">
                <span class="row-emoji">${emojiMap[emotionValue]}</span>
            </td>
            <td class="reason-cell">
                <input type="text" class="reason-input" value="${escapeHtml(reasonValue)}" 
                    placeholder="사유" data-hour="${h}" onchange="saveEmotionRow(${h})">
                ${existing ? `<button class="row-delete-btn" onclick="deleteEmotionByHour(${h}, '${dateStr}')">×</button>` : ''}
            </td>
        </tr>`;
    }
    tbody.innerHTML = html;
}

function updateRowEmoji(slider) {
    const emoji = slider.parentElement.querySelector('.row-emoji');
    emoji.textContent = emojiMap[slider.value];
    saveEmotionRow(parseInt(slider.dataset.hour));
}

function saveEmotionRow(hour) {
    const dateStr = emotionTableDate.toISOString().split('T')[0];
    const row = document.querySelector(`tr[data-hour="${hour}"]`);
    const slider = row.querySelector('.emotion-row-slider');
    const reasonInput = row.querySelector('.reason-input');
    
    const level = parseInt(slider.value);
    const reason = reasonInput.value.trim();
    const timeStr = `${hour.toString().padStart(2,'0')}:00`;
    
    let emotions = getData(KEYS.emotions);
    emotions = emotions.filter(e => !(e.date === dateStr && e.time.startsWith(hour.toString().padStart(2,'0'))));
    emotions.push({ id: Date.now(), date: dateStr, time: timeStr, level, reason: reason || null, timestamp: new Date().toISOString() });
    setData(KEYS.emotions, emotions);
    renderEmotionGraph();
    setTimeout(() => renderEmotionInputTable(), 100);
}

function deleteEmotionByHour(hour, dateStr) {
    let emotions = getData(KEYS.emotions);
    emotions = emotions.filter(e => !(e.date === dateStr && e.time.startsWith(hour.toString().padStart(2,'0'))));
    setData(KEYS.emotions, emotions);
    renderEmotionInputTable();
    renderEmotionGraph();
}

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
    if (!container) return;
    const width = container.offsetWidth || 300, height = 150;
    const padding = { top: 10, right: 10, bottom: 25, left: 10 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    
    if (style === 'line') {
        const points = dailyData.map((val, i) => val === null ? null : { x: padding.left + (i / (days.length - 1)) * graphWidth, y: padding.top + graphHeight - ((val - 1) / 4) * graphHeight, val }).filter(p => p !== null);
        let pathD = ''; points.forEach((p, i) => { pathD += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`; });
        container.innerHTML = `<svg width="${width}" height="${height}">${[0, 0.25, 0.5, 0.75, 1].map(p => `<line x1="${padding.left}" y1="${padding.top + p * graphHeight}" x2="${width - padding.right}" y2="${padding.top + p * graphHeight}" stroke="#E8E8E8" stroke-width="1"/>`).join('')}<path d="${pathD}" fill="none" stroke="url(#lineGradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="#B1D9D4" stroke-width="2"/>`).join('')}<defs><linearGradient id="lineGradient" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" style="stop-color:#FFCDD2"/><stop offset="50%" style="stop-color:#FFF9C4"/><stop offset="100%" style="stop-color:#C8E6C9"/></linearGradient></defs></svg><div class="emotion-x-labels">${days.filter((_, i) => i % Math.ceil(period / 5) === 0 || i === days.length - 1).map(d => { const date = new Date(d); return `<span>${date.getMonth()+1}/${date.getDate()}</span>`; }).join('')}</div>`;
    } else {
        const barWidth = graphWidth / days.length * 0.7, barGap = graphWidth / days.length * 0.15;
        const colors = ['#FFCDD2', '#FFE0B2', '#FFF9C4', '#DCEDC8', '#C8E6C9'];
        container.innerHTML = `<svg width="${width}" height="${height}">${dailyData.map((val, i) => { if (val === null) return ''; const x = padding.left + i * (barWidth + barGap * 2) + barGap; const barHeight = ((val) / 5) * graphHeight; const y = padding.top + graphHeight - barHeight; return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${colors[Math.round(val) - 1] || '#B1D9D4'}" rx="2"/>`; }).join('')}</svg><div class="emotion-x-labels">${days.filter((_, i) => i % Math.ceil(period / 5) === 0 || i === days.length - 1).map(d => { const date = new Date(d); return `<span>${date.getMonth()+1}/${date.getDate()}</span>`; }).join('')}</div>`;
    }
}

// Lab Tabs
function switchLabTab(tab, el) {
    document.querySelectorAll('#page-lab .archive-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.lab-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab === 'emotion') { renderEmotionGraph(); renderEmotionInputTable(); }
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
            isBreakTime = true; timerSeconds = 5 * 60; document.getElementById('timerLabel').textContent = '휴식 시간'; alert('집중 시간 완료!');
        } else { isBreakTime = false; timerSeconds = 25 * 60; document.getElementById('timerLabel').textContent = '집중 시간'; alert('휴식 끝!'); }
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
    let startDate = new Date(), periodLabel = ''; const todayStr = getToday();
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
        const labels = ['', '😢 안좋음', '😔 별로', '😐 보통', '🙂 좋음', '😊 아주 좋음'];
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
    let startDate = new Date(), periodName = ''; const todayStr = getToday();
    if (selectedPeriod === 'daily') periodName = '오늘';
    else if (selectedPeriod === 'weekly') { startDate.setDate(startDate.getDate() - 7); periodName = '이번 주'; }
    else { startDate.setMonth(startDate.getMonth() - 1); periodName = '이번 달'; }
    const startStr = startDate.toISOString().split('T')[0];
    const fMemos = selectedPeriod === 'daily' ? memos.filter(m => m.date === todayStr) : memos.filter(m => m.date >= startStr);
    const fEmotions = selectedPeriod === 'daily' ? emotions.filter(e => e.date === todayStr) : emotions.filter(e => e.date >= startStr);
    const fArchives = selectedPeriod === 'daily' ? archives.filter(a => a.date === todayStr) : archives.filter(a => a.date >= startStr);
    let prompt = `당신은 개인 기록 분석 전문가입니다. 아래는 제가 ${periodName} 기록한 데이터입니다.\n\n## 분석 요청\n1. 전반적인 감정 상태와 흐름\n2. 주요 관심사나 생각 패턴\n3. 소비한 콘텐츠에서 보이는 취향\n4. 개선하거나 주의할 점\n5. 격려 메시지\n\n---\n\n## 📊 기록 데이터\n\n### 감정 기록\n`;
    if (fEmotions.length > 0) fEmotions.forEach(e => prompt += `- ${e.date} ${e.time}: ${emojiMap[e.level]}${e.reason ? ' (' + e.reason + ')' : ''}\n`);
    else prompt += `기록 없음\n`;
    prompt += `\n### 메모/일기\n`;
    if (fMemos.length > 0) fMemos.forEach(m => { prompt += `- [${m.date}] [${m.tag}] ${m.title ? m.title + ': ' : ''}${m.content}\n`; });
    else prompt += `기록 없음\n`;
    prompt += `\n### 소비한 콘텐츠\n`;
    if (fArchives.length > 0) fArchives.forEach(a => prompt += `- [${getTypeName(a.type)}] ${a.title} (${a.date})\n`);
    else prompt += `기록 없음\n`;
    return prompt + `\n---\n\n위 데이터를 바탕으로 친근하고 따뜻한 톤으로 분석해주세요.`;
}

function copyExport() { document.getElementById('exportContent').select(); document.execCommand('copy'); document.getElementById('copySuccess').style.display = 'block'; setTimeout(() => document.getElementById('copySuccess').style.display = 'none', 2000); }

// Data Management
function exportData() {
    const data = { memos: getData(KEYS.memos), emotions: getData(KEYS.emotions), archives: getData(KEYS.archives), focus: getData(KEYS.focus), todos: getData(KEYS.todos), events: getData(KEYS.events), exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `minimi_backup_${getToday()}.json`; a.click();
}

function importData(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { const data = JSON.parse(ev.target.result); if (data.memos) setData(KEYS.memos, data.memos); if (data.emotions) setData(KEYS.emotions, data.emotions); if (data.archives) setData(KEYS.archives, data.archives); if (data.focus) setData(KEYS.focus, data.focus); if (data.todos) setData(KEYS.todos, data.todos); if (data.events) setData(KEYS.events, data.events); alert('데이터를 성공적으로 가져왔습니다!'); init(); } catch (err) { alert('파일 읽기 오류: ' + err.message); } };
    reader.readAsText(file);
}

function clearAllData() { if (!confirm('정말 모든 데이터를 삭제할까요?')) return; if (!confirm('마지막 확인입니다. 삭제할까요?')) return; Object.values(KEYS).forEach(k => localStorage.removeItem(k)); alert('모든 데이터가 삭제되었습니다.'); init(); }

document.addEventListener('DOMContentLoaded', init);

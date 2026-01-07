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

// Event Colors
const eventColors = ['#0F0F12', '#FF6B6B', '#FF8787', '#FFA8A8', '#F783AC', '#DA77F2', '#9775FA', '#748FFC', '#4DABF7', '#38D9A9', '#69DB7C', '#A9E34B', '#FFD43B', '#FFA94D', '#FF8A65', '#A1887F', '#ADB5BD', '#868E96', '#5C7CFA', '#20C997'];
let selectedEventColor = '#0F0F12';

// State
let currentPage = 'memo', currentViewMode = 'masonry', isCalendarMode = false;
let memoCalendarDate = new Date(), selectedMemoDate = getToday();
let currentArchiveTab = 'content', currentContentType = 'book', contentCalendarDate = new Date();
let uploadedImage = null, attachedContent = null, editingMemoId = null;
let selectedArchiveTypeModal = 'book';
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
    if (!icon) return;
    icon.className = 'view-toggle-icon memo-only';
    if (currentViewMode === 'grid') icon.classList.add('grid-icon');
    else if (currentViewMode === 'list') icon.classList.add('list-icon');
    icon.innerHTML = currentViewMode === 'grid' ? '<span></span><span></span><span></span><span></span>' : currentViewMode === 'list' ? '<span></span><span></span><span></span>' : '<span></span><span></span>';
}

function cycleViewMode() {
    const modes = ['masonry', 'grid', 'list'];
    currentViewMode = modes[(modes.indexOf(currentViewMode) + 1) % modes.length];
    updateViewIcon();
    renderMemos();
}

// Calendar Mode Toggle
function toggleCalendarMode() {
    isCalendarMode = !isCalendarMode;
    document.getElementById('memoNormalView').style.display = isCalendarMode ? 'none' : 'block';
    document.getElementById('memoCalendarView').classList.toggle('active', isCalendarMode);
    if (isCalendarMode) { renderMemoCalendar(); renderSelectedDayInfo(); }
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
    if (currentPage === 'archive') { renderArchiveTypeGrid(); openModal('addArchiveModal'); }
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
    uploadedImage = null; attachedContent = null; editingMemoId = null;
}

function handleImageUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { uploadedImage = ev.target.result; const area = document.getElementById('imageUploadArea'); area.innerHTML = `<img src="${uploadedImage}"><input type="file" accept="image/*" onchange="handleImageUpload(event)" style="display:none;">`; area.classList.add('has-image'); };
    reader.readAsDataURL(file);
}

// Memo Calendar
function renderMemoCalendar() {
    const y = memoCalendarDate.getFullYear(), m = memoCalendarDate.getMonth();
    document.getElementById('memoCalendarTitle').textContent = `${y}년 ${m + 1}월`;
    const firstDay = new Date(y, m, 1).getDay(), lastDate = new Date(y, m + 1, 0).getDate();
    const memos = getData(KEYS.memos), events = getData(KEYS.events);
    const memosByDate = {}, eventsByDate = {};
    memos.forEach(memo => { if (!memosByDate[memo.date]) memosByDate[memo.date] = []; memosByDate[memo.date].push(memo); });
    events.forEach(ev => { if (!eventsByDate[ev.date]) eventsByDate[ev.date] = []; eventsByDate[ev.date].push(ev); });
    const today = getToday();
    let html = ['일','월','화','수','목','금','토'].map(d => `<div class="daily-cal-weekday">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) html += '<div class="daily-cal-day empty"></div>';
    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const hasMemo = memosByDate[dateStr] && memosByDate[dateStr].length > 0;
        const dayEvents = eventsByDate[dateStr] || [];
        const isToday = dateStr === today, isSelected = dateStr === selectedMemoDate;
        let eventDots = dayEvents.length > 0 ? '<div class="cal-event-dots">' + dayEvents.slice(0, 3).map(ev => `<span class="cal-event-dot" style="background:${ev.color}"></span>`).join('') + '</div>' : '';
        html += `<div class="daily-cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasMemo ? 'has-memo' : ''}" onclick="selectMemoDate('${dateStr}')"><span class="cal-day-num">${d}</span>${eventDots}</div>`;
    }
    document.getElementById('memoCalendarGrid').innerHTML = html;
}

function selectMemoDate(dateStr) { selectedMemoDate = dateStr; renderMemoCalendar(); renderSelectedDayInfo(); }
function prevMemoMonth() { memoCalendarDate.setMonth(memoCalendarDate.getMonth() - 1); renderMemoCalendar(); }
function nextMemoMonth() { memoCalendarDate.setMonth(memoCalendarDate.getMonth() + 1); renderMemoCalendar(); }

function renderSelectedDayInfo() {
    const dateObj = new Date(selectedMemoDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    document.getElementById('selectedDateHeader').textContent = `${dateObj.getFullYear()}년 ${dateObj.getMonth()+1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;
    renderDayEvents();
    renderTodos();
    const memos = getData(KEYS.memos).filter(m => m.date === selectedMemoDate);
    const container = document.getElementById('dailyMemosContainer');
    container.innerHTML = memos.length === 0 ? '<div style="text-align:center;color:var(--text-secondary);padding:1rem;font-size:0.85rem;">이 날의 메모가 없어요</div>' : memos.map(m => `<div class="card-mini" onclick="viewMemo(${m.id})">${m.image ? `<div class="card-image-placeholder"><img src="${m.image}"></div>` : ''}<div class="card-content-wrapper">${m.title ? `<div class="card-title">${escapeHtml(m.title)}</div>` : ''}<div class="card-date">${formatDate(m.timestamp)}</div><div class="card-content-text">${escapeHtml(m.content)}</div><span class="card-tag">${m.tag}</span></div></div>`).join('');
}

// Event (일정) Functions
function renderDayEvents() {
    const events = getData(KEYS.events).filter(e => e.date === selectedMemoDate);
    const container = document.getElementById('dailyEventsSection');
    container.innerHTML = events.length === 0 ? '' : events.map(e => {
        const timeText = e.allDay ? '하루 종일' : `${e.startTime || ''} ~ ${e.endTime || ''}`;
        return `<div class="daily-event-item" onclick="editEvent(${e.id})"><div class="event-color-dot" style="background:${e.color}"></div><div class="event-info"><div class="event-title-text">${escapeHtml(e.title)}</div><div class="event-time-text">${timeText}</div></div><button class="event-delete-btn" onclick="event.stopPropagation();deleteEvent(${e.id})">×</button></div>`;
    }).join('');
}

function openEventModal() {
    selectedEventColor = '#0F0F12';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventMemo').value = '';
    document.getElementById('eventAllDay').checked = false;
    document.getElementById('editEventId').value = '';
    const dateObj = new Date(selectedMemoDate);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    document.getElementById('eventDateDisplay').textContent = `${dateObj.getMonth()+1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;
    const startSelect = document.getElementById('eventStartHour'), endSelect = document.getElementById('eventEndHour');
    startSelect.innerHTML = '<option value="">시작</option>'; endSelect.innerHTML = '<option value="">종료</option>';
    for (let h = 0; h < 24; h++) { for (let m = 0; m < 60; m += 30) { const timeStr = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`; startSelect.innerHTML += `<option value="${timeStr}">${timeStr}</option>`; endSelect.innerHTML += `<option value="${timeStr}">${timeStr}</option>`; } }
    document.getElementById('colorPalette').innerHTML = eventColors.map(c => `<div class="color-option ${c === selectedEventColor ? 'selected' : ''}" style="background:${c}" onclick="selectEventColor('${c}')"></div>`).join('');
    updateEventColorBar(); toggleAllDay(); openModal('addEventModal');
}

function selectEventColor(color) { selectedEventColor = color; document.querySelectorAll('.color-option').forEach(el => el.classList.toggle('selected', el.style.background === color || el.style.backgroundColor === color)); updateEventColorBar(); }
function updateEventColorBar() { document.getElementById('eventColorBar').style.background = selectedEventColor; }
function toggleAllDay() { const isAllDay = document.getElementById('eventAllDay').checked; document.getElementById('eventStartHour').disabled = isAllDay; document.getElementById('eventEndHour').disabled = isAllDay; if (isAllDay) { document.getElementById('eventStartHour').value = ''; document.getElementById('eventEndHour').value = ''; } }

function saveEvent(e) {
    e.preventDefault();
    const title = document.getElementById('eventTitle').value.trim(); if (!title) return;
    const events = getData(KEYS.events);
    const eventData = { title, date: selectedMemoDate, color: selectedEventColor, allDay: document.getElementById('eventAllDay').checked, startTime: document.getElementById('eventStartHour').value || null, endTime: document.getElementById('eventEndHour').value || null, memo: document.getElementById('eventMemo').value.trim() || null, timestamp: new Date().toISOString() };
    const editId = document.getElementById('editEventId').value;
    if (editId) { const idx = events.findIndex(ev => ev.id === parseInt(editId)); if (idx >= 0) events[idx] = { ...events[idx], ...eventData }; }
    else { eventData.id = Date.now(); events.push(eventData); }
    setData(KEYS.events, events); closeModal('addEventModal'); renderSelectedDayInfo(); renderMemoCalendar();
}

function editEvent(id) {
    const ev = getData(KEYS.events).find(e => e.id === id); if (!ev) return;
    openEventModal();
    document.getElementById('eventTitle').value = ev.title;
    document.getElementById('eventMemo').value = ev.memo || '';
    document.getElementById('eventAllDay').checked = ev.allDay || false;
    document.getElementById('editEventId').value = id;
    if (ev.startTime) document.getElementById('eventStartHour').value = ev.startTime;
    if (ev.endTime) document.getElementById('eventEndHour').value = ev.endTime;
    selectEventColor(ev.color || '#0F0F12'); toggleAllDay();
}

function deleteEvent(id) { if (!confirm('일정을 삭제할까요?')) return; setData(KEYS.events, getData(KEYS.events).filter(e => e.id !== id)); renderSelectedDayInfo(); renderMemoCalendar(); }

// Todo
function toggleTodoSection() { document.getElementById('todoContent').classList.toggle('collapsed'); document.getElementById('todoArrow').classList.toggle('collapsed'); }
function handleTodoKeypress(e) { if (e.key === 'Enter') addTodo(); }
function addTodo() { const input = document.getElementById('todoInput'); const text = input.value.trim(); if (!text) return; const todos = getData(KEYS.todos); todos.push({ id: Date.now(), text, done: false, date: selectedMemoDate }); setData(KEYS.todos, todos); input.value = ''; renderTodos(); }
function renderTodos() { const todos = getData(KEYS.todos).filter(t => t.date === selectedMemoDate); document.getElementById('todoList').innerHTML = todos.length === 0 ? '<div style="text-align:center;color:var(--text-secondary);padding:0.5rem;font-size:0.8rem;">할 일이 없어요</div>' : todos.map(t => `<div class="todo-item"><div class="todo-checkbox ${t.done ? 'checked' : ''}" onclick="toggleTodo(${t.id})">${t.done ? '✓' : ''}</div><span class="todo-text ${t.done ? 'done' : ''}">${escapeHtml(t.text)}</span><button class="todo-delete" onclick="deleteTodo(${t.id})">×</button></div>`).join(''); }
function toggleTodo(id) { const todos = getData(KEYS.todos); const idx = todos.findIndex(t => t.id === id); if (idx >= 0) { todos[idx].done = !todos[idx].done; setData(KEYS.todos, todos); renderTodos(); } }
function deleteTodo(id) { setData(KEYS.todos, getData(KEYS.todos).filter(t => t.id !== id)); renderTodos(); }

// Memo CRUD
function saveMemo(e) {
    e.preventDefault();
    const title = document.getElementById('memoTitle').value.trim();
    const content = document.getElementById('memoContent').value.trim(); if (!content) return;
    const memos = getData(KEYS.memos);
    const memoData = { title: title || null, content, image: uploadedImage, attachment: attachedContent, date: getToday(), timestamp: new Date().toISOString() };
    if (editingMemoId) { const idx = memos.findIndex(m => m.id === editingMemoId); if (idx >= 0) memos[idx] = { ...memos[idx], ...memoData }; }
    else { memoData.id = Date.now(); memos.unshift(memoData); }
    setData(KEYS.memos, memos);
    if (attachedContent && !editingMemoId) addToArchiveFromMemo(attachedContent, content, memoData.date);
    closeModal('addMemoModal'); renderMemos(); renderArchiveCategories();
}

function addToArchiveFromMemo(attachment, memoContent, date) {
    if (!attachment || !attachment.title) { console.log('No attachment to add'); return; }
    const archives = getData(KEYS.archives);
    console.log('Adding to archive:', attachment);
    if (archives.some(a => a.title === attachment.title && a.date === date)) { console.log('Already exists'); return; }
    archives.unshift({ id: Date.now(), title: attachment.title, note: memoContent.substring(0, 100), type: attachment.type, image: attachment.image || null, author: attachment.author || null, director: attachment.director || null, address: attachment.address || null, date: date, timestamp: new Date().toISOString(), fromMemo: true });
    setData(KEYS.archives, archives);
    console.log('Archive saved:', archives.length);
}

function renderMemos() {
    const memos = getData(KEYS.memos);
    const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
    const filtered = memos.filter(m => m.content.toLowerCase().includes(search) || (m.title && m.title.toLowerCase().includes(search)));
    const container = document.getElementById('memoContainer');
    container.className = 'cards-compact';
    if (currentViewMode === 'grid') container.classList.add('grid-view');
    else if (currentViewMode === 'list') container.classList.add('list-view');
    if (filtered.length === 0) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">아직 메모가 없어요</div></div>'; return; }
    container.innerHTML = filtered.map(m => {
        // 배경 스타일 계산
        let bgStyle = '';
        if (m.bgId && m.bgId !== 'none') {
            const bgOption = memoBgs.find(b => b.id === m.bgId);
            if (bgOption && bgOption.url) bgStyle = `background-image:url('${bgOption.url}');background-size:100px;`;
        } else if (m.color && m.color !== '#FFFFFF') {
            bgStyle = `background-color:${m.color};`;
        }
        
        if (currentViewMode === 'grid') { 
            if (!m.image) return ''; 
            return `<div class="card-mini grid-item" style="${bgStyle}" onclick="viewMemo(${m.id})"><div class="card-image-placeholder"><img src="${m.image}"></div></div>`; 
        }
        // 타일뷰(masonry)에서는 날짜 안보임, 리스트뷰에서는 날짜 보임
        const showDate = currentViewMode === 'list';
        return `<div class="card-mini" style="${bgStyle}" onclick="viewMemo(${m.id})">${m.image ? `<div class="card-image-placeholder"><img src="${m.image}"></div>` : ''}<div class="card-content-wrapper">${m.title ? `<div class="card-title">${escapeHtml(m.title)}</div>` : ''}${showDate ? `<div class="card-date">${formatDate(m.timestamp)}</div>` : ''}<div class="card-content-text">${escapeHtml(m.content)}</div></div></div>`;
    }).join('');
}

function handleSearch() { renderMemos(); }

// 메모 색상 & 배경 옵션
const memoColors = ['#FFFFFF', '#FF8A80', '#FFD180', '#FFFF8D', '#CCFF90', '#A7FFEB', '#80D8FF', '#82B1FF', '#B388FF', '#F8BBD9'];
const memoBgs = [
    { id: 'none', url: null },
    { id: 'rose', url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#FFF0F5"/><circle cx="50" cy="50" r="20" fill="#FFB6C1" opacity="0.5"/><circle cx="150" cy="80" r="25" fill="#FFC0CB" opacity="0.4"/><circle cx="80" cy="150" r="18" fill="#FFB6C1" opacity="0.6"/><circle cx="170" cy="170" r="15" fill="#FFC0CB" opacity="0.5"/></svg>') },
    { id: 'coffee', url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#FDF5E6"/><circle cx="40" cy="60" r="12" fill="#DEB887" opacity="0.4"/><circle cx="160" cy="40" r="15" fill="#D2B48C" opacity="0.3"/><circle cx="100" cy="140" r="20" fill="#DEB887" opacity="0.3"/><circle cx="170" cy="160" r="10" fill="#D2B48C" opacity="0.4"/></svg>') },
    { id: 'bunny', url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#FFF0F5"/><ellipse cx="60" cy="60" rx="8" ry="15" fill="#FFB6C1" opacity="0.5"/><ellipse cx="75" cy="60" rx="8" ry="15" fill="#FFB6C1" opacity="0.5"/><circle cx="67" cy="80" r="12" fill="#FFC0CB" opacity="0.4"/><ellipse cx="150" cy="140" rx="8" ry="15" fill="#FFB6C1" opacity="0.5"/><ellipse cx="165" cy="140" rx="8" ry="15" fill="#FFB6C1" opacity="0.5"/><circle cx="157" cy="160" r="12" fill="#FFC0CB" opacity="0.4"/></svg>') }
];
let currentViewingMemoId = null;
let currentMemoColor = '#FFFFFF';
let currentMemoBg = 'none';

function viewMemo(id) {
    const memo = getData(KEYS.memos).find(m => m.id === id); if (!memo) return;
    currentViewingMemoId = id;
    currentMemoColor = memo.color || '#FFFFFF';
    currentMemoBg = memo.bgId || 'none';
    
    // 체크리스트 렌더링
    let checklistHtml = '';
    if (memo.checklist && memo.checklist.length > 0) {
        checklistHtml = '<div class="memo-checklist">' + memo.checklist.map((item, idx) => 
            `<div class="checklist-item"><div class="checklist-checkbox ${item.done ? 'checked' : ''}" onclick="toggleMemoCheckItem(${idx})">${item.done ? '✓' : ''}</div><input type="text" class="checklist-text ${item.done ? 'done' : ''}" value="${escapeHtml(item.text)}" onchange="updateCheckItemText(${idx}, this.value)"></div>`
        ).join('') + '</div>';
    }
    
    let attHtml = memo.attachment ? `<div class="detail-attachment"><div style="display:flex;align-items:center;gap:0.75rem;"><div style="width:50px;height:70px;background:var(--border-light);border-radius:4px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">${memo.attachment.image ? `<img src="${memo.attachment.image}" style="width:100%;height:100%;object-fit:cover;">` : `<span style="font-size:1.5rem;">${getTypeIcon(memo.attachment.type)}</span>`}</div><div><div style="font-weight:500;margin-bottom:0.25rem;">${memo.attachment.title}</div><div style="font-size:0.75rem;color:var(--text-secondary);">${memo.attachment.author || memo.attachment.director || memo.attachment.address || getTypeName(memo.attachment.type)}</div></div></div></div>` : '';
    
    const editDate = new Date(memo.timestamp);
    document.getElementById('memoEditDate').textContent = `수정한 날짜: ${editDate.getFullYear()}년 ${editDate.getMonth()+1}월 ${editDate.getDate()}일`;
    
    // 배경 적용
    const detailView = document.getElementById('memoDetailView');
    const bgOption = memoBgs.find(b => b.id === currentMemoBg);
    if (bgOption && bgOption.url) {
        detailView.style.background = `url("${bgOption.url}") repeat`;
    } else {
        detailView.style.background = currentMemoColor;
    }
    
    document.getElementById('detailContent').innerHTML = `
        ${memo.image ? `<img src="${memo.image}" class="detail-image">` : ''}
        <input type="text" class="detail-title-input" value="${escapeHtml(memo.title || '')}" placeholder="제목" onchange="updateMemoField('title', this.value)">
        <textarea class="detail-content-input" placeholder="메모" onchange="updateMemoField('content', this.value)">${escapeHtml(memo.content)}</textarea>
        ${checklistHtml}
        ${attHtml}
    `;
    openModal('viewDetailModal');
}

function updateMemoField(field, value) {
    if (!currentViewingMemoId) return;
    const memos = getData(KEYS.memos);
    const idx = memos.findIndex(m => m.id === currentViewingMemoId);
    if (idx >= 0) {
        memos[idx][field] = value;
        memos[idx].timestamp = new Date().toISOString();
        setData(KEYS.memos, memos);
        const editDate = new Date();
        document.getElementById('memoEditDate').textContent = `수정한 날짜: ${editDate.getFullYear()}년 ${editDate.getMonth()+1}월 ${editDate.getDate()}일`;
    }
}

function editMemo(id) {
    const memo = getData(KEYS.memos).find(m => m.id === id); if (!memo) return;
    closeModal('viewDetailModal');
    document.getElementById('memoModalTitle').textContent = '메모 수정';
    document.getElementById('memoTitle').value = memo.title || '';
    document.getElementById('memoContent').value = memo.content;
    document.getElementById('editMemoId').value = id;
    document.getElementById('memoSubmitBtn').textContent = '수정';
    if (memo.image) { uploadedImage = memo.image; const area = document.getElementById('imageUploadArea'); area.innerHTML = `<img src="${memo.image}"><input type="file" accept="image/*" onchange="handleImageUpload(event)" style="display:none;">`; area.classList.add('has-image'); }
    if (memo.attachment) { attachedContent = memo.attachment; displayAttachment(memo.attachment); }
    editingMemoId = id; openModal('addMemoModal');
}

function deleteMemo(id) { if (!confirm('삭제할까요?')) return; setData(KEYS.memos, getData(KEYS.memos).filter(m => m.id !== id)); closeModal('viewDetailModal'); renderMemos(); }

// Bottom Sheet 메뉴들
function openMemoAddMenu() { document.getElementById('memoAddMenu').classList.add('active'); }
function openMemoColorMenu() {
    // 색상 옵션 렌더링
    document.getElementById('memoColorRow').innerHTML = memoColors.map(c => 
        `<div class="memo-color-option ${c === currentMemoColor ? 'selected' : ''}" style="background:${c}" onclick="selectMemoColor('${c}')"></div>`
    ).join('');
    // 배경 옵션 렌더링
    document.getElementById('memoBgRow').innerHTML = memoBgs.map(bg => 
        bg.id === 'none' 
            ? `<div class="memo-bg-option no-bg ${currentMemoBg === 'none' ? 'selected' : ''}" onclick="selectMemoBg('none')">✕</div>`
            : `<div class="memo-bg-option ${currentMemoBg === bg.id ? 'selected' : ''}" style="background-image:url('${bg.url}')" onclick="selectMemoBg('${bg.id}')"></div>`
    ).join('');
    document.getElementById('memoColorMenu').classList.add('active');
}
function openMemoMoreMenu() { document.getElementById('memoMoreMenu').classList.add('active'); }
function closeBottomSheet(id) { document.getElementById(id).classList.remove('active'); }

function selectMemoColor(color) {
    currentMemoColor = color;
    currentMemoBg = 'none';
    if (!currentViewingMemoId) return;
    const memos = getData(KEYS.memos);
    const idx = memos.findIndex(m => m.id === currentViewingMemoId);
    if (idx >= 0) { memos[idx].color = color; memos[idx].bgId = 'none'; setData(KEYS.memos, memos); }
    document.getElementById('memoDetailView').style.background = color;
    closeBottomSheet('memoColorMenu');
    renderMemos();
}

function selectMemoBg(bgId) {
    currentMemoBg = bgId;
    if (!currentViewingMemoId) return;
    const memos = getData(KEYS.memos);
    const idx = memos.findIndex(m => m.id === currentViewingMemoId);
    if (idx >= 0) { memos[idx].bgId = bgId; setData(KEYS.memos, memos); }
    const bgOption = memoBgs.find(b => b.id === bgId);
    const detailView = document.getElementById('memoDetailView');
    if (bgOption && bgOption.url) { detailView.style.background = `url("${bgOption.url}") repeat`; }
    else { detailView.style.background = currentMemoColor; }
    closeBottomSheet('memoColorMenu');
    renderMemos();
}

// 카메라/갤러리
function triggerMemoCamera() {
    closeBottomSheet('memoAddMenu');
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => handleMemoImageAdd(e);
    input.click();
}
function triggerMemoGallery() {
    closeBottomSheet('memoAddMenu');
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e) => handleMemoImageAdd(e);
    input.click();
}
function handleMemoImageAdd(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        if (!currentViewingMemoId) return;
        const memos = getData(KEYS.memos);
        const idx = memos.findIndex(m => m.id === currentViewingMemoId);
        if (idx >= 0) { memos[idx].image = ev.target.result; memos[idx].timestamp = new Date().toISOString(); setData(KEYS.memos, memos); viewMemo(currentViewingMemoId); renderMemos(); }
    };
    reader.readAsDataURL(file);
}

// 체크박스
function addMemoCheckbox() {
    closeBottomSheet('memoAddMenu');
    if (!currentViewingMemoId) return;
    const memos = getData(KEYS.memos);
    const idx = memos.findIndex(m => m.id === currentViewingMemoId);
    if (idx >= 0) {
        if (!memos[idx].checklist) memos[idx].checklist = [];
        memos[idx].checklist.push({ text: '', done: false });
        setData(KEYS.memos, memos);
        viewMemo(currentViewingMemoId);
    }
}
function toggleMemoCheckItem(checkIdx) {
    if (!currentViewingMemoId) return;
    const memos = getData(KEYS.memos);
    const idx = memos.findIndex(m => m.id === currentViewingMemoId);
    if (idx >= 0 && memos[idx].checklist && memos[idx].checklist[checkIdx]) {
        memos[idx].checklist[checkIdx].done = !memos[idx].checklist[checkIdx].done;
        setData(KEYS.memos, memos);
        viewMemo(currentViewingMemoId);
    }
}
function updateCheckItemText(checkIdx, text) {
    if (!currentViewingMemoId) return;
    const memos = getData(KEYS.memos);
    const idx = memos.findIndex(m => m.id === currentViewingMemoId);
    if (idx >= 0 && memos[idx].checklist && memos[idx].checklist[checkIdx]) {
        memos[idx].checklist[checkIdx].text = text;
        setData(KEYS.memos, memos);
    }
}

// 더보기 메뉴 기능
function deleteCurrentMemo() {
    closeBottomSheet('memoMoreMenu');
    if (!currentViewingMemoId) return;
    if (!confirm('삭제할까요?')) return;
    setData(KEYS.memos, getData(KEYS.memos).filter(m => m.id !== currentViewingMemoId));
    closeModal('viewDetailModal');
    renderMemos();
}
function duplicateMemo() {
    closeBottomSheet('memoMoreMenu');
    if (!currentViewingMemoId) return;
    const memo = getData(KEYS.memos).find(m => m.id === currentViewingMemoId);
    if (!memo) return;
    const memos = getData(KEYS.memos);
    const newMemo = { ...memo, id: Date.now(), title: (memo.title || '') + ' (사본)', timestamp: new Date().toISOString() };
    memos.unshift(newMemo);
    setData(KEYS.memos, memos);
    closeModal('viewDetailModal');
    renderMemos();
    alert('사본이 생성되었습니다.');
}
function shareMemo() {
    closeBottomSheet('memoMoreMenu');
    if (!currentViewingMemoId) return;
    const memo = getData(KEYS.memos).find(m => m.id === currentViewingMemoId);
    if (!memo) return;
    const shareText = (memo.title ? memo.title + '\n\n' : '') + memo.content;
    if (navigator.share) {
        navigator.share({ title: memo.title || '메모', text: shareText }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareText).then(() => alert('클립보드에 복사되었습니다.')).catch(() => {});
    }
}

// Archive
function switchArchiveTab(tab, el) {
    currentArchiveTab = tab;
    document.querySelectorAll('#page-archive .archive-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('archiveContentTab').style.display = tab === 'content' ? 'block' : 'none';
    document.getElementById('archiveMediaTab').style.display = tab === 'media' ? 'block' : 'none';
    document.getElementById('archivePlaceTab').style.display = tab === 'place' ? 'block' : 'none';
    document.getElementById('contentCalendar').style.display = 'none';
    if (tab === 'content') renderArchiveCategories();
    else if (tab === 'media') renderMediaGallery();
    else if (tab === 'place') renderPlaceList();
}

function renderArchiveCategories() {
    const archives = getData(KEYS.archives);
    ['book', 'movie', 'tv', 'music'].forEach(type => {
        const items = archives.filter(a => a.type === type);
        document.getElementById(`${type}Count`).textContent = `> ${items.length}건`;
        const thumbsContainer = document.getElementById(`${type}Thumbs`);
        thumbsContainer.innerHTML = items.length === 0 ? `<div class="archive-thumb">${getTypeIcon(type)}</div>` : items.slice(0, 5).map(a => a.image ? `<div class="archive-thumb"><img src="${a.image}"></div>` : `<div class="archive-thumb">${getTypeIcon(type)}</div>`).join('');
    });
}

function showContentCalendar(type) {
    currentContentType = type;
    document.getElementById('archiveContentTab').style.display = 'none';
    document.getElementById('contentCalendar').style.display = 'block';
    document.getElementById('contentCalendarTitle').textContent = getTypeName(type);
    renderContentCalendar();
}

function hideContentCalendar() { document.getElementById('contentCalendar').style.display = 'none'; document.getElementById('archiveContentTab').style.display = 'block'; }

function renderContentCalendar() {
    const y = contentCalendarDate.getFullYear(), m = contentCalendarDate.getMonth();
    document.getElementById('contentMonthTitle').textContent = `${y}.${String(m+1).padStart(2,'0')}`;
    const firstDay = new Date(y, m, 1).getDay(), lastDate = new Date(y, m + 1, 0).getDate();
    const archives = getData(KEYS.archives).filter(a => a.type === currentContentType);
    const archivesByDate = {}; archives.forEach(a => { if (!archivesByDate[a.date]) archivesByDate[a.date] = []; archivesByDate[a.date].push(a); });
    let html = ['일','월','화','수','목','금','토'].map(d => `<div class="content-cal-weekday">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) html += '<div class="content-cal-day empty"></div>';
    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayArchives = archivesByDate[dateStr] || [];
        if (dayArchives.length > 0 && dayArchives[0].image) html += `<div class="content-cal-day has-content"><img src="${dayArchives[0].image}"></div>`;
        else if (dayArchives.length > 0) html += `<div class="content-cal-day has-content" style="background:var(--accent-mint);font-size:1rem;">${getTypeIcon(currentContentType)}</div>`;
        else html += `<div class="content-cal-day"><span class="content-day-num">${d}</span></div>`;
    }
    document.getElementById('contentCalendarGrid').innerHTML = html;
}

function prevContentMonth() { contentCalendarDate.setMonth(contentCalendarDate.getMonth() - 1); renderContentCalendar(); }
function nextContentMonth() { contentCalendarDate.setMonth(contentCalendarDate.getMonth() + 1); renderContentCalendar(); }

function renderMediaGallery() {
    const memos = getData(KEYS.memos).filter(m => m.image);
    document.getElementById('mediaGrid').innerHTML = memos.length === 0 ? '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📷</div><div class="empty-text">아직 사진이 없어요</div></div>' : memos.map(m => `<div class="media-thumb" onclick="viewImage('${m.image}', '${escapeHtml(m.content.substring(0,50))}')"><img src="${m.image}"></div>`).join('');
}

function viewImage(src, info) { document.getElementById('imageViewImg').src = src; document.getElementById('imageViewInfo').textContent = info; openModal('imageViewModal'); }

function renderPlaceList() {
    const archives = getData(KEYS.archives).filter(a => a.type === 'place' || a.address);
    document.getElementById('placeList').innerHTML = archives.length === 0 ? '<div class="empty-state"><div class="empty-icon">📍</div><div class="empty-text">아직 장소가 없어요</div></div>' : archives.map(a => `<div class="place-item"><div class="place-thumb">${a.image ? `<img src="${a.image}" style="width:100%;height:100%;object-fit:cover;">` : '📍'}</div><div class="place-info"><div class="place-name">${escapeHtml(a.title)}</div><div class="place-category">${a.address || '장소'}</div><div class="place-date">${a.date}</div></div></div>`).join('');
}

// Content Search
function openSearchModal() { isArchiveSearch = false; currentSearchType = 'book'; document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.type === 'book')); document.getElementById('contentSearchInput').value = ''; document.getElementById('searchResults').innerHTML = '<div class="search-empty">검색어를 입력하세요</div>'; openModal('searchContentModal'); }
function selectSearchType(type) { currentSearchType = type; document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.type === type)); }
function handleSearchKeypress(e) { if (e.key === 'Enter') searchContent(); }

async function searchContent() {
    const query = document.getElementById('contentSearchInput').value.trim(); if (!query) return;
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '<div class="search-loading">검색 중...</div>';
    try {
        const apiMap = { book: 'book.json', movie: 'webkr.json', tv: 'webkr.json', music: 'webkr.json', place: 'local.json' };
        const searchQuery = currentSearchType === 'movie' ? query + ' 영화' : currentSearchType === 'tv' ? query + ' 드라마' : query;
        const url = `https://openapi.naver.com/v1/search/${apiMap[currentSearchType]}?query=${encodeURIComponent(searchQuery)}&display=10`;
        const response = await fetch(CORS_PROXY + encodeURIComponent(url), { headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET } });
        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();
        if (!data.items || data.items.length === 0) { resultsContainer.innerHTML = '<div class="search-empty">검색 결과가 없습니다</div>'; return; }
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
    } catch (error) { resultsContainer.innerHTML = '<div class="search-empty">검색 중 오류가 발생했습니다.</div>'; }
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
    } else { attachedContent = item; displayAttachment(item); }
    closeModal('searchContentModal');
}

function displayAttachment(item) { document.getElementById('attachedThumb').innerHTML = item.image ? `<img src="${item.image}">` : getTypeIcon(item.type); document.getElementById('attachedTitle').textContent = item.title; document.getElementById('attachedMeta').textContent = item.author || item.director || item.address || getTypeName(item.type); document.getElementById('attachedContent').style.display = 'flex'; }
function removeAttachment() { attachedContent = null; document.getElementById('attachedContent').style.display = 'none'; }

// Archive CRUD
function renderArchiveTypeGrid() {
    const grid = document.getElementById('archiveTypeGrid');
    if (currentArchiveTab === 'place') { grid.innerHTML = '<div class="archive-type-btn active" data-type="place"><div class="archive-type-icon">📍</div><div class="archive-type-label">장소</div></div>'; selectedArchiveTypeModal = 'place'; }
    else { const types = ['book', 'movie', 'tv', 'music']; const names = { book: '책', movie: '영화', tv: '드라마', music: '음악' }; const icons = { book: '📚', movie: '🎬', tv: '📺', music: '🎵' }; grid.innerHTML = types.map((t, i) => `<div class="archive-type-btn ${i === 0 ? 'active' : ''}" data-type="${t}" onclick="selectArchiveTypeModal(this)"><div class="archive-type-icon">${icons[t]}</div><div class="archive-type-label">${names[t]}</div></div>`).join(''); selectedArchiveTypeModal = 'book'; }
}

function selectArchiveTypeModal(el) { document.querySelectorAll('.archive-type-btn').forEach(b => b.classList.remove('active')); el.classList.add('active'); selectedArchiveTypeModal = el.dataset.type; }
function openArchiveSearchModal() { isArchiveSearch = true; currentSearchType = selectedArchiveTypeModal; document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.type === selectedArchiveTypeModal)); document.getElementById('contentSearchInput').value = ''; document.getElementById('searchResults').innerHTML = '<div class="search-empty">검색어를 입력하세요</div>'; openModal('searchContentModal'); }

function saveArchive(e) {
    e.preventDefault();
    const title = document.getElementById('archiveTitle').value.trim(); if (!title) return;
    const archives = getData(KEYS.archives);
    archives.unshift({ id: Date.now(), title, note: document.getElementById('archiveNote').value.trim() || null, type: selectedArchiveTypeModal, image: document.getElementById('archiveImage').value || null, author: document.getElementById('archiveAuthor').value || null, director: document.getElementById('archiveDirector').value || null, address: document.getElementById('archiveAddress').value || null, date: getToday(), timestamp: new Date().toISOString() });
    setData(KEYS.archives, archives); closeModal('addArchiveModal');
    document.getElementById('archiveTitle').value = ''; document.getElementById('archiveNote').value = ''; document.getElementById('archiveImage').value = ''; document.getElementById('archiveSearchResult').style.display = 'none';
    renderArchiveCategories();
}

// Emotion
function updateEmotionDateDisplay() { const el = document.getElementById('emotionDateDisplay'); if (el) { const y = emotionTableDate.getFullYear(), m = emotionTableDate.getMonth() + 1, d = emotionTableDate.getDate(); el.textContent = `${y}.${m.toString().padStart(2,'0')}.${d.toString().padStart(2,'0')}`; } }
function changeEmotionDate(delta) { emotionTableDate.setDate(emotionTableDate.getDate() + delta); updateEmotionDateDisplay(); renderEmotionInputTable(); }
function toggleSection(sectionId) { document.getElementById(sectionId + 'Content').classList.toggle('closed'); document.getElementById(sectionId + 'Arrow').classList.toggle('collapsed'); }

function renderEmotionInputTable() {
    const dateStr = emotionTableDate.toISOString().split('T')[0];
    const emotions = getData(KEYS.emotions).filter(e => e.date === dateStr);
    const tbody = document.getElementById('emotionInputTableBody'); if (!tbody) return;
    const byHour = {}; emotions.forEach(e => { const hour = parseInt(e.time.split(':')[0]); if (!byHour[hour]) byHour[hour] = []; byHour[hour].push(e); });
    let html = '';
    for (let h = 0; h < 24; h++) {
        const existing = byHour[h] ? byHour[h][0] : null;
        const emotionValue = existing ? existing.level : 3;
        const reasonValue = existing ? (existing.reason || '') : '';
        html += `<tr data-hour="${h}"><td class="hour-cell">${h}시</td><td class="slider-cell"><input type="range" min="1" max="5" value="${emotionValue}" class="emotion-row-slider" data-hour="${h}" oninput="updateRowValue(this)"><span class="row-value">${emotionValue}</span></td><td class="reason-cell"><input type="text" class="reason-input" value="${escapeHtml(reasonValue)}" placeholder="사유" data-hour="${h}" onchange="saveEmotionRow(${h})">${existing ? `<button class="row-delete-btn" onclick="deleteEmotionByHour(${h}, '${dateStr}')">×</button>` : ''}</td></tr>`;
    }
    tbody.innerHTML = html;
}

function updateRowValue(slider) { slider.parentElement.querySelector('.row-value').textContent = slider.value; saveEmotionRow(parseInt(slider.dataset.hour)); }

function saveEmotionRow(hour) {
    const dateStr = emotionTableDate.toISOString().split('T')[0];
    const row = document.querySelector(`tr[data-hour="${hour}"]`);
    const level = parseInt(row.querySelector('.emotion-row-slider').value);
    const reason = row.querySelector('.reason-input').value.trim();
    const timeStr = `${hour.toString().padStart(2,'0')}:00`;
    let emotions = getData(KEYS.emotions);
    emotions = emotions.filter(e => !(e.date === dateStr && e.time.startsWith(hour.toString().padStart(2,'0'))));
    emotions.push({ id: Date.now(), date: dateStr, time: timeStr, level, reason: reason || null, timestamp: new Date().toISOString() });
    setData(KEYS.emotions, emotions); renderEmotionGraph(); setTimeout(() => renderEmotionInputTable(), 100);
}

function deleteEmotionByHour(hour, dateStr) { setData(KEYS.emotions, getData(KEYS.emotions).filter(e => !(e.date === dateStr && e.time.startsWith(hour.toString().padStart(2,'0'))))); renderEmotionInputTable(); renderEmotionGraph(); }

function renderEmotionGraph() {
    const emotions = getData(KEYS.emotions);
    const container = document.getElementById('emotionLineChart'); if (!container) return;
    
    // 최근 7일 데이터 준비
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d.toISOString().split('T')[0]); }
    
    // 각 날짜별 시간대 평균 계산 (0~23시)
    const width = container.offsetWidth || 300, height = 180;
    const padding = { top: 20, right: 20, bottom: 30, left: 30 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    
    // 색상: 오늘 민트색, 나머지 검은색~회색 (오래될수록 옅어짐)
    const colors = ['#D4D4D4', '#A3A3A3', '#737373', '#525252', '#404040', '#262626', '#B1D9D4'];
    
    let svg = `<svg width="${width}" height="${height}">`;
    
    // Y축 눈금 (0-5)
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (graphHeight * (5 - i) / 5);
        svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#E8E8E8" stroke-width="1"/>`;
        svg += `<text x="${padding.left - 8}" y="${y + 4}" font-size="10" fill="#999" text-anchor="end">${i}</text>`;
    }
    
    // X축 눈금 (0-24시)
    const hours = [0, 6, 12, 18, 24];
    hours.forEach(h => {
        const x = padding.left + (h / 24) * graphWidth;
        svg += `<text x="${x}" y="${height - 8}" font-size="9" fill="#999" text-anchor="middle">${h}</text>`;
    });
    
    // 각 날짜별 선 그리기
    days.forEach((day, dayIdx) => {
        const dayEmotions = emotions.filter(e => e.date === day).sort((a, b) => a.time.localeCompare(b.time));
        if (dayEmotions.length === 0) return;
        
        const color = colors[dayIdx];
        const strokeWidth = dayIdx === 6 ? 2.5 : 1.5; // 오늘은 두껍게
        
        let pathD = '';
        dayEmotions.forEach((e, i) => {
            const hour = parseInt(e.time.split(':')[0]);
            const x = padding.left + (hour / 24) * graphWidth;
            const y = padding.top + graphHeight - (e.level / 5) * graphHeight;
            pathD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
        });
        
        svg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    
    svg += `</svg>`;
    
    // 범례
    let legend = '<div class="emotion-legend">';
    const dayLabels = days.map((d, i) => {
        const date = new Date(d);
        if (i === 6) return '오늘';
        return `${date.getMonth()+1}/${date.getDate()}`;
    });
    for (let i = 6; i >= 0; i--) {
        legend += `<div class="legend-item"><div class="legend-color" style="background:${colors[i]}"></div><span>${dayLabels[i]}</span></div>`;
    }
    legend += '</div>';
    
    container.innerHTML = svg + legend;
}

// Lab Tabs
function switchLabTab(tab, el) { document.querySelectorAll('#page-lab .archive-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); document.querySelectorAll('.lab-tab-content').forEach(c => c.classList.remove('active')); document.getElementById(`tab-${tab}`).classList.add('active'); if (tab === 'emotion') { renderEmotionGraph(); renderEmotionInputTable(); } }

// Timer
function toggleTimer() { if (isTimerRunning) { clearInterval(timerInterval); document.getElementById('timerStartBtn').textContent = '계속'; } else { timerInterval = setInterval(updateTimer, 1000); document.getElementById('timerStartBtn').textContent = '일시정지'; } isTimerRunning = !isTimerRunning; }
function updateTimer() { if (timerSeconds <= 0) { clearInterval(timerInterval); isTimerRunning = false; if (!isBreakTime) { const focus = getData(KEYS.focus); focus.push({ date: getToday(), duration: 25, timestamp: new Date().toISOString() }); setData(KEYS.focus, focus); updateFocusStats(); isBreakTime = true; timerSeconds = 5 * 60; document.getElementById('timerLabel').textContent = '휴식 시간'; alert('집중 시간 완료!'); } else { isBreakTime = false; timerSeconds = 25 * 60; document.getElementById('timerLabel').textContent = '집중 시간'; alert('휴식 끝!'); } document.getElementById('timerStartBtn').textContent = '시작'; updateTimerDisplay(); return; } timerSeconds--; updateTimerDisplay(); }
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
    if (fEmotions.length > 0) { const avg = fEmotions.reduce((s, e) => s + e.level, 0) / fEmotions.length; const labels = ['', '😢 안좋음', '😔 별로', '😐 보통', '🙂 좋음', '😊 아주 좋음']; document.getElementById('reportEmotion').textContent = labels[Math.round(avg)]; document.getElementById('reportEmotionDesc').textContent = `평균 ${avg.toFixed(1)}점 (${fEmotions.length}회)`; }
    else { document.getElementById('reportEmotion').textContent = '-'; document.getElementById('reportEmotionDesc').textContent = '기록된 감정이 없어요'; }
    const tagCounts = {}; fMemos.forEach(m => tagCounts[m.tag] = (tagCounts[m.tag] || 0) + 1);
    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    document.getElementById('reportTags').innerHTML = sortedTags.length > 0 ? sortedTags.map((t, i) => `<span class="keyword-tag ${i === 0 ? 'highlight' : ''}">${t[0]} (${t[1]})</span>`).join('') : '<span class="keyword-tag">아직 데이터가 없어요</span>';
    document.getElementById('reportContents').textContent = `${fArchives.length}개`;
    document.getElementById('reportContentsDetail').textContent = `책 ${fArchives.filter(a => a.type === 'book').length} · 영화 ${fArchives.filter(a => a.type === 'movie').length} · TV ${fArchives.filter(a => a.type === 'tv').length}`;
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
    if (fMemos.length > 0) fMemos.forEach(m => prompt += `- [${m.date}] [${m.tag}] ${m.title ? m.title + ': ' : ''}${m.content}\n`);
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

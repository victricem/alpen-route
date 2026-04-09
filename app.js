// --- 狀態管理與 i18n 函式 ---
let currentLang = localStorage.getItem('alpine_lang') || 'zh-TW';
let currentStationId = 'ogizawa';
let currentRouteIndex = 0;
let selectedTravelDate = new Date();

function t(key) {
    return i18n[currentLang][key] || key;
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('alpine_lang', lang);
    document.getElementById('lang-select').value = lang;
    
    // 更新靜態 HTML 的語系
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if(i18n[lang] && i18n[lang][key]) {
            el.innerHTML = i18n[lang][key];
        }
    });

    // 重新渲染動態區塊 (統一交給 onRouteChange 處理，確保所有文字都更新到)
    onRouteChange(currentRouteIndex);
}

// --- 核心日期判斷邏輯 ---
const holidays2026 = ['04-29', '05-03', '05-04', '05-05', '05-06', '07-20', '08-11', '09-21', '09-22', '09-23', '10-12', '11-03', '11-23'];
const specifiedDays = ['05-02','05-03','05-04','05-05','07-18','07-19','08-11','08-12','08-13','08-14','08-15','09-19','09-20','09-21','09-22','10-10','10-11'];

function isWeekendOrHoliday(dateObj) {
    const day = dateObj.getDay();
    if (day === 0 || day === 6) return true;
    const mmdd = String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
    return holidays2026.includes(mmdd);
}

function isTimeValidToday(mark, dateObj) {
    if (!mark) return true; 
    const mmdd = String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + String(dateObj.getDate()).padStart(2, '0');
    const m = dateObj.getMonth() + 1;
    const d = dateObj.getDate();

    switch(mark) {
        case '●': return specifiedDays.includes(mmdd);
        case '◇': return ((m === 4 && d >= 15) || (m === 5 && d <= 15)) || specifiedDays.includes(mmdd);
        case '※': 
            if (!isWeekendOrHoliday(dateObj)) return false;
            return ((m === 4 && d >= 15) || m === 5) || ((m === 7 && d >= 11) || m === 8) || (m >= 9 && m <= 11);
        case '▽': return !isWeekendOrHoliday(dateObj); // 平日
        case '▼': return isWeekendOrHoliday(dateObj); // 假日
        default: return true;
    }
}

function initDate() {
    const now = new Date();
    const routeOpenDate = new Date('2026-04-15T00:00:00');
    if (now < routeOpenDate) {
        selectedTravelDate = routeOpenDate;
    }
    const yyyy = selectedTravelDate.getFullYear();
    const mm = String(selectedTravelDate.getMonth() + 1).padStart(2, '0');
    const dd = String(selectedTravelDate.getDate()).padStart(2, '0');
    document.getElementById('travel-date').value = `${yyyy}-${mm}-${dd}`;
}

function onDateChange() {
    const inputDate = document.getElementById('travel-date').value;
    if (inputDate) {
        const [y, m, d] = inputDate.split('-');
        selectedTravelDate = new Date(y, m - 1, d);
        renderTimetable();
        updateCountdown();
    }
}

function onStationChange() {
    currentStationId = document.getElementById('station-select').value;
    currentRouteIndex = 0;
    renderRouteButtons();
    onRouteChange(0);
}

function renderRouteButtons() {
    const container = document.getElementById('route-buttons');
    const routes = schedules[currentStationId];
    
    container.innerHTML = routes.map((route, index) => {
        const isActive = index === currentRouteIndex;
        const activeClass = "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300 ring-offset-1";
        const inactiveClass = "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300";
        
        return `
            <button onclick="onRouteChange(${index})" class="flex-1 py-3 px-2 rounded-xl text-sm font-bold transition-all border-2 flex flex-col items-center justify-center ${isActive ? activeClass : inactiveClass}">
                <div class="text-[10px] ${isActive ? 'text-blue-200' : 'text-gray-400'} mb-1 font-black bg-black/10 px-2 py-0.5 rounded-full">${t(route.subKey)}</div>
                ${t(route.dirKey)}
                <span class="text-[10px] ${isActive ? 'text-blue-100' : 'text-gray-400'} font-normal tracking-wide inline-block mt-0.5">${t(route.vehKey)}</span>
            </button>
        `;
    }).join('');
}

function onRouteChange(index) {
    currentRouteIndex = index;
    renderRouteButtons();
    
    const currentRoute = schedules[currentStationId][currentRouteIndex];
    const vehicleEl = document.getElementById('route-vehicle');
    vehicleEl.innerText = t(currentRoute.vehKey);
    
    if(currentRoute.isWalk) {
        vehicleEl.className = "bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border border-emerald-200";
    } else {
        vehicleEl.className = "bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm border border-blue-200";
    }

    document.getElementById('table-title-text').innerText = `${t('t_full')} (${t(currentRoute.dirKey)})`;

    renderTimetable();
    updateCountdown();
}

function getBadgeColor(mark) {
    if (mark === '●') return 'bg-red-500';
    if (mark === '◇') return 'bg-pink-500';
    if (mark === '※') return 'bg-purple-500';
    if (mark === '▽') return 'bg-blue-500';
    if (mark === '▼') return 'bg-orange-500';
    return 'bg-gray-500';
}

function renderTimetable() {
    const container = document.getElementById('timetable-body');
    const headContainer = document.getElementById('timetable-head');
    const legendContainer = document.getElementById('timetable-legend');
    const currentRoute = schedules[currentStationId][currentRouteIndex];

    if (currentRoute.isWalk) {
        headContainer.style.display = 'none';
        legendContainer.style.display = 'none';
        container.innerHTML = `
            <tr>
                <td colspan="2" class="px-6 py-10 text-center text-gray-500">
                    <svg class="w-14 h-14 mx-auto mb-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 5a2 2 0 11-4 0 2 2 0 014 0zM7 11.5l3 3V22M17 11.5l-3 3V22M12 14.5L12 22"></path></svg>
                    <p class="font-bold text-lg text-gray-800 mb-1">${t('w_title')}</p>
                    <p class="text-sm leading-relaxed text-gray-500">${t('w_desc')}</p>
                </td>
            </tr>
        `;
        return;
    }

    headContainer.style.display = 'table-header-group';
    legendContainer.style.display = 'flex';
    
    const list = currentRoute.times;
    const grouped = {};
    list.forEach(item => {
        let [time, mark] = item.split('|');
        let [h, m] = time.split(':');
        if(!grouped[h]) grouped[h] = [];
        grouped[h].push({ m, mark });
    });

    container.innerHTML = Object.keys(grouped).sort().map(hour => `
        <tr class="hover:bg-blue-50/50 transition-colors group relative z-10">
            <td class="px-6 py-4 font-black text-gray-800 text-lg border-r border-gray-100 bg-white group-hover:bg-blue-50/50">${hour}</td>
            <td class="px-6 py-4 flex flex-wrap gap-x-3 gap-y-3">
                ${grouped[hour].map(item => {
                    let badgeHtml = '';
                    if(item.mark) {
                        let colorClass = getBadgeColor(item.mark);
                        badgeHtml = `<span class="absolute -top-2 -right-2 text-[9px] ${colorClass} text-white w-[18px] h-[18px] flex items-center justify-center rounded-full shadow-sm font-black z-20 border border-white leading-none">${item.mark}</span>`;
                    }
                    
                    if(isTimeValidToday(item.mark, selectedTravelDate)) {
                        return `
                            <span class="relative bg-gray-100 border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-sm font-mono font-bold shadow-sm hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-default select-none">
                                ${item.m}${badgeHtml}
                            </span>
                        `;
                    } else {
                        return `
                            <span class="relative bg-gray-50 border border-dashed border-gray-200 text-gray-300 px-2.5 py-1.5 rounded-lg text-sm font-mono font-medium opacity-50 cursor-not-allowed select-none line-through" title="Not operating">
                                ${item.m}${badgeHtml}
                            </span>
                        `;
                    }
                }).join('')}
            </td>
        </tr>
    `).join('');
}

function updateCountdown() {
    const currentRoute = schedules[currentStationId][currentRouteIndex];
    const countdownEl = document.getElementById('countdown');
    const nextTimeEl = document.getElementById('next-time');
    const countdownLabel = document.getElementById('countdown-label');
    const timeLabel = document.getElementById('time-label');
    const cardEl = document.getElementById('countdown-card');

    if (currentRoute.isWalk) {
        cardEl.className = "next-bus-card bg-emerald-50 rounded-2xl shadow-sm p-6 mb-6 border border-emerald-100 relative overflow-hidden transition-all duration-300";
        countdownLabel.innerText = t('c_stat');
        timeLabel.innerText = t('c_est');
        countdownEl.innerText = t('c_ready');
        countdownEl.className = "text-4xl md:text-5xl font-black text-emerald-600 mb-5 tracking-tight";
        nextTimeEl.innerText = t('c_15m');
        return;
    }

    const now = new Date();
    const isToday = (selectedTravelDate.getDate() === now.getDate() && selectedTravelDate.getMonth() === now.getMonth() && selectedTravelDate.getFullYear() === now.getFullYear());

    cardEl.className = "next-bus-card bg-white rounded-2xl shadow-lg p-6 mb-6 border-t-4 border-blue-600 relative overflow-hidden transition-all duration-300";
    
    if (isToday) {
        countdownLabel.innerText = t('c_next');
    } else {
        countdownLabel.innerHTML = `${t('c_next')} <span class="ml-2 text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">${t('c_prev')}</span>`;
    }

    timeLabel.innerText = t('c_time');
    nextTimeEl.className = "text-3xl font-black text-gray-800 tracking-tight";
    
    const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    const list = currentRoute.times;
    let nextBus = null;

    for(let item of list) {
        let [cleanTime, mark] = item.split('|');
        if(cleanTime > currentTimeStr && isTimeValidToday(mark, selectedTravelDate)) {
            nextBus = cleanTime;
            break;
        }
    }

    if(nextBus) {
        const [nH, nM] = nextBus.split(':').map(Number);
        const nextDate = new Date(now);
        nextDate.setHours(nH, nM, 0);

        const diff = nextDate - now;
        const diffMin = Math.floor(diff / 1000 / 60);
        const diffSec = Math.floor((diff / 1000) % 60);

        countdownEl.innerText = `${diffMin}:${diffSec.toString().padStart(2, '0')}`;
        countdownEl.className = "text-5xl md:text-6xl font-black text-blue-700 mb-5 tracking-tighter tabular-nums";
        nextTimeEl.innerText = nextBus;
    } else {
        countdownEl.innerText = t('c_end');
        countdownEl.className = "text-4xl font-black text-gray-300 mb-5 tracking-tight";
        nextTimeEl.innerText = t('c_tmr');
    }
}

setInterval(() => {
    const now = new Date();
    document.getElementById('current-time').innerText = now.toLocaleTimeString('en-US', { hour12: false });
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' };
    document.getElementById('current-date').innerText = now.toLocaleDateString(currentLang === 'ja' ? 'ja-JP' : (currentLang === 'zh-CN' ? 'zh-CN' : 'en-US'), options);
    updateCountdown();
}, 1000);

window.onload = () => {
    initDate();
    changeLanguage(currentLang);
};

// --- PWA 支援 (動態產生 Manifest 與 Service Worker) ---
const manifestJSON = {
    name: "2026 立山黑部全線時刻表",
    short_name: "Alpine Route",
    description: "2026 立山黑部阿爾卑斯路線即時時刻表與倒數",
    start_url: location.pathname,
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#1e3a8a",
    icons: [{
        src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231e3a8a'><path d='M12 3l-9 15h18z'/></svg>",
        sizes: "192x192",
        type: "image/svg+xml"
    }, {
        src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%231e3a8a'><path d='M12 3l-9 15h18z'/></svg>",
        sizes: "512x512",
        type: "image/svg+xml"
    }]
};
const manifestBlob = new Blob([JSON.stringify(manifestJSON)], { type: 'application/manifest+json' });
const link = document.createElement('link');
link.rel = 'manifest';
link.href = URL.createObjectURL(manifestBlob);
document.head.appendChild(link);

if ('serviceWorker' in navigator) {
    const swCode = `
        const CACHE_NAME = 'tateyama-cache-v2';
        self.addEventListener('install', (event) => {
            self.skipWaiting();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['', location.pathname, location.href])));
        });
        self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
        self.addEventListener('fetch', (event) => {
            event.respondWith(caches.match(event.request).then((r) => r || fetch(event.request)).catch(() => caches.match(location.pathname)));
        });
    `;
    navigator.serviceWorker.register(URL.createObjectURL(new Blob([swCode], { type: 'application/javascript' })));
}

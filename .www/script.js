// --- 1. INISIALISASI INDEXEDDB ---
let db;
const request = indexedDB.open("StandaloneAppDatabase", 3);

request.onupgradeneeded = function(e) {
    db = e.target.result;
    if (!db.objectStoreNames.contains("manga_pdfs")) {
        const store = db.createObjectStore("manga_pdfs", { keyPath: "id", autoIncrement: true });
        store.createIndex("folder", "folder", { unique: false });
    }
    if (!db.objectStoreNames.contains("offline_music")) {
        const musicStore = db.createObjectStore("offline_music", { keyPath: "id", autoIncrement: true });
        musicStore.createIndex("folder", "folder", { unique: false });
    }
};

request.onsuccess = function(e) { db = e.target.result; };
request.onerror = function() { console.error("Gagal menginisialisasi IndexedDB"); };

const offlineDatabase = [
    { title: "Akasha: Goodnight Punpun", author: "Inio Asano", volumes: 13, keywords: ["akasha", "goodnight punpun", "oyasumi punpun", "punpun", "inio asano"] },
    { title: "One Piece", author: "Eiichiro Oda", volumes: 108, keywords: ["one piece", "op", "luffy", "strawhat"] },
    { title: "Naruto", author: "Masashi Kishimoto", volumes: 72, keywords: ["naruto", "shippuden", "uzumaki"] },
    { title: "Jujutsu Kaisen", author: "Gege Akutami", volumes: 27, keywords: ["jujutsu kaisen", "jjk", "gojo", "itadori"] }
];

// --- 2. MANAJEMEN TEMA & MENU ---
const topSettingsPopup = document.getElementById('top-settings-popup');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

function toggleTopMenu(event) {
    event.stopPropagation();
    const isOpen = topSettingsPopup.style.display === 'flex';
    topSettingsPopup.style.display = isOpen ? 'none' : 'flex';
}

function closeTopMenu() {
    topSettingsPopup.style.display = 'none';
}

function updateThemeUI(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.innerText = "🌙";
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggleBtn.innerText = "☀️";
    }
}

const savedTheme = localStorage.getItem('theme');
updateThemeUI(savedTheme === 'dark' ? 'dark' : 'light');

function toggleTheme() {
    const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', nextTheme);
    updateThemeUI(nextTheme);
}

// --- 3. KATALOG KOMIK & AUTOCOMPLETE ---
let comicCatalog = JSON.parse(localStorage.getItem('myComicCatalogFinalTextOnly')) || [
    { id: 201, title: "Akasha: Goodnight Punpun", author: "Inio Asano", totalVolumes: 13, type: "reguler" },
    { id: 100, title: "Frieren: Beyond Journey's End", author: "Kanehito Yamada & Tsukasa Abe", totalVolumes: 13, type: "reguler" }
];
let ownedVolumesData = JSON.parse(localStorage.getItem('ownedVolumesDataFinalTextOnly')) || {};
let currentActiveComicId = null;

const searchInput = document.getElementById('search');
const addComicForm = document.getElementById('add-comic-form');
const formTitleInput = document.getElementById('form-title');
const formAuthorInput = document.getElementById('form-author');
const formVolInput = document.getElementById('form-total-vol');
const fetchStatusEl = document.getElementById('fetch-status');
const suggestionsBox = document.getElementById('suggestions-box');
const comicGridEl = document.getElementById('comic-list');

formTitleInput.addEventListener('input', function () {
    const query = this.value.trim().toLowerCase();
    suggestionsBox.innerHTML = '';

    if (query.length === 0) {
        suggestionsBox.style.display = 'none';
        fetchStatusEl.innerText = '';
        return;
    }

    const filtered = offlineDatabase.filter(item => {
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchKeyword = item.keywords && item.keywords.some(k => k.toLowerCase().includes(query));
        return matchTitle || matchKeyword;
    });

    if (filtered.length > 0) {
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <span class="suggestion-icon">🔍</span>
                <div class="suggestion-details">
                    <span class="suggestion-title">${item.title}</span>
                    <span class="suggestion-sub">Komik • ${item.author} (${item.volumes} Vol)</span>
                </div>
            `;
            div.addEventListener('click', function () {
                formTitleInput.value = item.title;
                formAuthorInput.value = item.author;
                formVolInput.value = item.volumes;
                suggestionsBox.style.display = 'none';
                fetchStatusEl.innerText = '⚡ Data ditemukan!';
            });
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
        fetchStatusEl.innerText = 'ℹ️ Judul belum ada di database. Silakan isi manual.';
    }
});

document.addEventListener('click', function (e) {
    if (!e.target.closest('.autocomplete-wrapper')) {
        suggestionsBox.style.display = 'none';
    }
});

function sortCatalogBindUpFirst() {
    comicCatalog.sort((a, b) => {
        if (a.type === 'bindup' && b.type !== 'bindup') return -1;
        if (a.type !== 'bindup' && b.type === 'bindup') return 1;
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    });
}

function renderComics() {
    sortCatalogBindUpFirst();
    const searchText = searchInput.value.toLowerCase();
    comicGridEl.innerHTML = '';

    comicCatalog.forEach(comic => {
        if (comic.title.toLowerCase().includes(searchText) || comic.author.toLowerCase().includes(searchText)) {
            const ownedList = ownedVolumesData[comic.id] || [];
            const totalOwned = ownedList.filter(vol => vol <= comic.totalVolumes).length;
            const isCompleted = totalOwned === comic.totalVolumes && comic.totalVolumes > 0;

            const card = document.createElement('div');
            card.className = 'comic-card';
            card.setAttribute('draggable', true);
            card.setAttribute('data-id', comic.id);

            const bindUpBadgeHtml = comic.type === 'bindup' ? '<div class="comic-type-badge">Bind-Up</div>' : '';
            const completedBadgeHtml = isCompleted ? '<div class="comic-completed-badge">Completed</div>' : '';

            card.innerHTML = `
                <button class="btn-delete" onclick="deleteComic(event, ${comic.id})">×</button>
                <div class="comic-clickable-area" onclick="openModal(${comic.id})">
                    <div class="comic-info">
                        <div class="title-wrapper">
                            <h3 class="comic-title">${comic.title}</h3>${bindUpBadgeHtml}${completedBadgeHtml}
                        </div>
                        <div class="comic-meta-row">
                            <div class="comic-meta">${comic.author}</div>
                            <div class="comic-owned-status">📦 ${totalOwned}/${comic.totalVolumes} Vol</div>
                        </div>
                    </div>
                </div>
            `;

            card.addEventListener('dragstart', () => card.classList.add('dragging'));
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                saveNewOrder();
            });

            comicGridEl.appendChild(card);
        }
    });
}

comicGridEl.addEventListener('dragover', e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(comicGridEl, e.clientX, e.clientY);
    const draggingCard = document.querySelector('.dragging');
    if (afterElement == null) {
        comicGridEl.appendChild(draggingCard);
    } else {
        comicGridEl.insertBefore(draggingCard, afterElement);
    }
});

function getDragAfterElement(container, x, y) {
    const dragElements = [...container.querySelectorAll('.comic-card:not(.dragging)')];
    return dragElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offsetY = y - box.top - box.height / 2;
        if (offsetY < 0 && offsetY > closest.offset) {
            return { offset: offsetY, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function saveNewOrder() {
    const currentCards = [...comicGridEl.querySelectorAll('.comic-card')];
    const newOrderedCatalog = [];
    currentCards.forEach(card => {
        const id = parseInt(card.getAttribute('data-id'));
        const comic = comicCatalog.find(c => c.id === id);
        if (comic) newOrderedCatalog.push(comic);
    });
    comicCatalog.forEach(comic => {
        if (!newOrderedCatalog.find(c => c.id === comic.id)) newOrderedCatalog.push(comic);
    });
    comicCatalog = newOrderedCatalog;
    localStorage.setItem('myComicCatalogFinalTextOnly', JSON.stringify(comicCatalog));
}

function openModal(id) {
    currentActiveComicId = id;
    const comic = comicCatalog.find(c => c.id === id);
    if (!comic) return;
    document.getElementById('modal-title').innerText = comic.title;
    document.getElementById('modal-author').innerText = comic.author;
    document.getElementById('modal-input-total-vol').value = comic.totalVolumes;
    renderModalVolumes(comic);
    document.getElementById('comic-modal').style.display = 'flex';
}

function renderModalVolumes(comic) {
    const grid = document.getElementById('modal-volumes-grid');
    grid.innerHTML = '';
    const ownedList = ownedVolumesData[comic.id] || [];
    for (let i = 1; i <= comic.totalVolumes; i++) {
        const isOwned = ownedList.includes(i);
        const box = document.createElement('label');
        box.className = `vol-box ${isOwned ? 'owned' : ''}`;
        box.innerHTML = `<input type="checkbox" ${isOwned ? 'checked' : ''} onchange="toggleVolumeOwned(${comic.id}, ${i})">Vol ${i}`;
        grid.appendChild(box);
    }
}

function toggleVolumeOwned(comicId, volNum) {
    if (!ownedVolumesData[comicId]) ownedVolumesData[comicId] = [];
    if (ownedVolumesData[comicId].includes(volNum)) {
        ownedVolumesData[comicId] = ownedVolumesData[comicId].filter(v => v !== volNum);
    } else {
        ownedVolumesData[comicId].push(volNum);
    }
    localStorage.setItem('ownedVolumesDataFinalTextOnly', JSON.stringify(ownedVolumesData));
    renderModalVolumes(comicCatalog.find(c => c.id === comicId));
    renderComics();
}

function updateTotalVolume() {
    const newTotal = parseInt(document.getElementById('modal-input-total-vol').value) || 1;
    const comic = comicCatalog.find(c => c.id === currentActiveComicId);
    if (comic) {
        comic.totalVolumes = newTotal;
        localStorage.setItem('myComicCatalogFinalTextOnly', JSON.stringify(comicCatalog));
        renderModalVolumes(comic);
        renderComics();
    }
}

// --- 4. MANGA READER OFFLINE (PDF / ZIP / CBZ) ---
function openPdfStorageSlide() {
    closeTopMenu();
    loadPdfFoldersUI();
    loadPdfStorageList();
    document.getElementById('pdf-storage-slide').classList.add('active');
}

function closePdfStorageSlide() {
    document.getElementById('pdf-storage-slide').classList.remove('active');
}

function handleUploadFolderSelectChange() {
    const select = document.getElementById('pdf-folder-select');
    const newInput = document.getElementById('pdf-new-folder-input');
    newInput.style.display = (select.value === '__NEW__') ? 'block' : 'none';
    if (select.value === '__NEW__') newInput.focus();
    else newInput.value = '';
}

function loadPdfFoldersUI() {
    if (!db) return;
    const tx = db.transaction("manga_pdfs", "readonly");
    const request = tx.objectStore("manga_pdfs").getAll();
    request.onsuccess = function() {
        const allPdfs = request.result;
        const foldersSet = new Set();
        allPdfs.forEach(pdf => { if (pdf.folder && pdf.folder !== "Tanpa Folder") foldersSet.add(pdf.folder); });

        const uploadSelect = document.getElementById('pdf-folder-select');
        const currentUploadVal = uploadSelect.value;
        uploadSelect.innerHTML = `<option value="Tanpa Folder">📄 Tanpa Folder</option><option value="__NEW__">➕ Buat Folder Baru...</option>`;
        foldersSet.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f; opt.innerText = "📁 " + f;
            uploadSelect.insertBefore(opt, uploadSelect.lastElementChild);
        });
        uploadSelect.value = [...uploadSelect.options].some(o => o.value === currentUploadVal) ? currentUploadVal : "Tanpa Folder";
        handleUploadFolderSelectChange();

        const filterSelect = document.getElementById('pdf-folder-filter');
        const currentFilterVal = filterSelect.value;
        filterSelect.innerHTML = '<option value="ALL">Semua Folder</option><option value="Tanpa Folder">📄 Tanpa Folder</option>';
        foldersSet.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f; opt.innerText = "📁 " + f;
            filterSelect.appendChild(opt);
        });
        filterSelect.value = [...filterSelect.options].some(o => o.value === currentFilterVal) ? currentFilterVal : "ALL";
    };
}

function readPdfTemporary() {
    const input = document.getElementById('pdf-file-input');
    if (!input.files || input.files.length === 0) { alert("Pilih file manga terlebih dahulu!"); return; }
    const file = input.files[0];
    const fileNameLower = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf";
    const isZip = fileNameLower.endsWith('.zip') || fileNameLower.endsWith('.cbz');

    if (!isPdf && !isZip) { alert("Format file harus .pdf, .zip, atau .cbz!"); return; }

    document.getElementById('pdf-viewer-title').innerText = file.name + " (Uploaded)";
    document.getElementById('pdf-viewer-slide').classList.add('active');
    
    const iframe = document.getElementById('pdf-iframe');
    const zipViewer = document.getElementById('zip-viewer');
    iframe.style.display = 'none'; zipViewer.style.display = 'none';

    if (isZip) {
        zipViewer.style.display = 'block';
        zipViewer.innerHTML = '<div style="padding:20px; text-align:center;">Mengekstrak komik, mohon tunggu...</div>';
        JSZip.loadAsync(file).then(async function(zip) {
            zipViewer.innerHTML = '';
            const imageFiles = Object.keys(zip.files).filter(name => name.match(/\.(jpg|jpeg|png|webp)$/i)).sort();
            for (const filename of imageFiles) {
                const fileData = await zip.files[filename].async("blob");
                const img = document.createElement('img');
                img.src = URL.createObjectURL(fileData);
                img.style.width = '100%'; img.style.display = 'block';
                zipViewer.appendChild(img);
            }
        });
    } else {
        iframe.style.display = 'block';
        iframe.src = URL.createObjectURL(file);
    }
}

function uploadPdfToStorage() {
    const input = document.getElementById('pdf-file-input');
    const folderSelect = document.getElementById('pdf-folder-select');
    const newFolderInput = document.getElementById('pdf-new-folder-input');

    if (!input.files || input.files.length === 0) { alert("Pilih file terlebih dahulu!"); return; }
    const filesArray = Array.from(input.files);
    let targetFolder = folderSelect.value === '__NEW__' ? (newFolderInput.value.trim() || "Tanpa Folder") : folderSelect.value;

    const tx = db.transaction("manga_pdfs", "readwrite");
    const store = tx.objectStore("manga_pdfs");
    filesArray.forEach(file => {
        store.add({
            fileName: file.name,
            fileSize: (file.size / (1024 * 1024)).toFixed(2) + " MB",
            fileData: file,
            folder: targetFolder,
            uploadedAt: new Date().toLocaleDateString('id-ID'),
            status: "Belum Dibaca"
        });
    });

    tx.oncomplete = function() {
        input.value = ""; newFolderInput.value = ""; folderSelect.value = targetFolder;
        loadPdfFoldersUI(); loadPdfStorageList();
        alert(`Berhasil menyimpan ${filesArray.length} file manga ke penyimpanan internal!`);
    };
}

async function downloadPdfToDeviceFolder(pdfId) {
    if (!db) return;
    const tx = db.transaction("manga_pdfs", "readonly");
    const req = tx.objectStore("manga_pdfs").get(pdfId);
    req.onsuccess = async function() {
        const record = req.result;
        if (record && record.fileData) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                const xxxDir = await dirHandle.getDirectoryHandle("xxx", { create: true });
                const mangaDir = await xxxDir.getDirectoryHandle("manga", { create: true });
                const fileHandle = await mangaDir.getFileHandle(record.fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(record.fileData);
                await writable.close();
                alert(`Sukses mendownload file ke folder perangkat: xxx/manga/${record.fileName}`);
            } catch (err) { console.log("Download dibatalkan.", err); }
        }
    };
}

function generatePdfItemHTML(pdf, fileIcon) {
    return `
        <div class="pdf-item-card">
            <div class="pdf-file-info">
                <span class="pdf-file-name" title="${pdf.fileName}">${fileIcon} ${pdf.fileName}</span>
                <span class="pdf-file-size">${pdf.fileSize} • ${pdf.uploadedAt}</span>
            </div>
            <div style="display:flex; align-items:center; flex-shrink: 0;">
                <button class="btn-pdf-action" onclick="readPdf(${pdf.id})">Buka</button>
                <button class="btn-pdf-download" onclick="downloadPdfToDeviceFolder(${pdf.id})" title="Download ke Folder xxx/manga">📥</button>
                <button class="btn-pdf-delete" onclick="deletePdf(${pdf.id})">×</button>
            </div>
        </div>
    `;
}

function loadPdfStorageList() {
    const container = document.getElementById('pdf-list-container');
    const selectedFolder = document.getElementById('pdf-folder-filter').value;
    const selectedStatus = document.getElementById('pdf-status-filter').value;
    container.innerHTML = "Memuat daftar file...";

    if (!db) return;
    const tx = db.transaction("manga_pdfs", "readonly");
    const request = tx.objectStore("manga_pdfs").getAll();

    request.onsuccess = function() {
        let allPdfs = request.result;
        container.innerHTML = "";

        if (selectedFolder !== "ALL") allPdfs = allPdfs.filter(pdf => (pdf.folder || "Tanpa Folder") === selectedFolder);
        if (selectedStatus !== "ALL") allPdfs = allPdfs.filter(pdf => (pdf.status || "Belum Dibaca") === selectedStatus);

        if (allPdfs.length === 0) {
            container.innerHTML = "<span style='font-size:13px; color:var(--text-muted); text-align:center; display:block; padding: 30px 0;'>Tidak ada file ditemukan.</span>";
            return;
        }

        const groupedFiles = {};
        allPdfs.forEach(pdf => {
            const folderName = pdf.folder || "Tanpa Folder";
            if (!groupedFiles[folderName]) groupedFiles[folderName] = [];
            groupedFiles[folderName].push(pdf);
        });

        Object.keys(groupedFiles).sort().forEach(folder => {
            if (folder === "Tanpa Folder") {
                groupedFiles[folder].forEach(pdf => {
                    const fileIcon = pdf.fileName.toLowerCase().match(/\.(zip|cbz)$/) ? "📦" : "📄";
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = generatePdfItemHTML(pdf, fileIcon);
                    container.appendChild(tempDiv.firstElementChild);
                });
            } else {
                const card = document.createElement('div');
                card.className = 'folder-accordion-card';
                const filesInFolder = groupedFiles[folder];
                let filesHtml = '';
                filesInFolder.forEach(pdf => {
                    const fileIcon = pdf.fileName.toLowerCase().match(/\.(zip|cbz)$/) ? "📦" : "📄";
                    filesHtml += generatePdfItemHTML(pdf, fileIcon);
                });

                card.innerHTML = `
                    <div class="folder-accordion-header" onclick="toggleFolderAccordion(this)">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span>📖</span><span>${folder}</span> <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">(${filesInFolder.length} File)</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button class="btn-read-folder" onclick="event.stopPropagation(); readFolderCombined('${folder}')">▶ Baca Gabung</button>
                            <span class="accordion-arrow">▼</span>
                        </div>
                    </div>
                    <div class="folder-content-list">${filesHtml}</div>
                `;
                container.appendChild(card);
            }
        });
    };
}

function toggleFolderAccordion(headerEl) {
    const card = headerEl.parentElement;
    card.classList.toggle('open');
    headerEl.querySelector('.accordion-arrow').innerText = card.classList.contains('open') ? '▲' : '▼';
}

function readPdf(pdfId) {
    const tx = db.transaction("manga_pdfs", "readonly");
    const req = tx.objectStore("manga_pdfs").get(pdfId);
    req.onsuccess = function() {
        const record = req.result;
        if (record) {
            document.getElementById('pdf-viewer-title').innerText = record.fileName;
            document.getElementById('pdf-viewer-slide').classList.add('active');
            const iframe = document.getElementById('pdf-iframe');
            const zipViewer = document.getElementById('zip-viewer');
            iframe.style.display = 'none'; zipViewer.style.display = 'none';

            if (record.fileName.toLowerCase().match(/\.(zip|cbz)$/)) {
                zipViewer.style.display = 'block';
                zipViewer.innerHTML = '<div style="padding:20px; text-align:center;">Mengekstrak komik...</div>';
                JSZip.loadAsync(record.fileData).then(async function(zip) {
                    zipViewer.innerHTML = '';
                    const imageFiles = Object.keys(zip.files).filter(name => name.match(/\.(jpg|jpeg|png|webp)$/i)).sort();
                    for (const filename of imageFiles) {
                        const fileData = await zip.files[filename].async("blob");
                        const img = document.createElement('img');
                        img.src = URL.createObjectURL(fileData);
                        img.style.width = '100%'; img.style.display = 'block';
                        zipViewer.appendChild(img);
                    }
                });
            } else {
                iframe.style.display = 'block';
                iframe.src = URL.createObjectURL(record.fileData);
            }
        }
    };
}

async function readFolderCombined(folderName) {
    if (!db) return;
    const tx = db.transaction("manga_pdfs", "readonly");
    const req = tx.objectStore("manga_pdfs").getAll();
    req.onsuccess = async function() {
        const allPdfs = req.result;
        const folderFiles = allPdfs.filter(pdf => (pdf.folder || "Tanpa Folder") === folderName && pdf.fileName.toLowerCase().match(/\.(zip|cbz)$/));
        if (folderFiles.length === 0) return;
        folderFiles.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, {numeric: true, sensitivity: 'base'}));

        document.getElementById('pdf-viewer-title').innerText = "Folder: " + folderName + " (Full Vol)";
        document.getElementById('pdf-viewer-slide').classList.add('active');
        const iframe = document.getElementById('pdf-iframe');
        const zipViewer = document.getElementById('zip-viewer');
        iframe.style.display = 'none'; zipViewer.style.display = 'block';
        zipViewer.innerHTML = '<div style="padding:20px; text-align:center;">Menggabungkan volume...</div>';

        try {
            zipViewer.innerHTML = '';
            for (const record of folderFiles) {
                const zip = await JSZip.loadAsync(record.fileData);
                const imageFiles = Object.keys(zip.files).filter(name => name.match(/\.(jpg|jpeg|png|webp)$/i)).sort();
                for (const filename of imageFiles) {
                    const fileData = await zip.files[filename].async("blob");
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(fileData);
                    img.style.width = '100%'; img.style.display = 'block';
                    zipViewer.appendChild(img);
                }
            }
        } catch (err) { zipViewer.innerHTML = '<div style="padding:20px; color:red; text-align:center;">Gagal memproses folder.</div>'; }
    };
}

function deletePdf(pdfId) {
    if (confirm("Hapus file manga ini?")) {
        const tx = db.transaction("manga_pdfs", "readwrite");
        tx.objectStore("manga_pdfs").delete(pdfId);
        tx.oncomplete = () => { loadPdfFoldersUI(); loadPdfStorageList(); };
    }
}

function closePdfViewerSlide() {
    document.getElementById('pdf-iframe').src = "";
    document.getElementById('zip-viewer').innerHTML = "";
    document.getElementById('pdf-viewer-slide').classList.remove('active');
}

// --- 5. PEMUTAR MUSIK OFFLINE ---
let currentActiveQueue = []; 
let currentQueueIndex = 0;   

function openMusicPlayerSlide() {
    closeTopMenu();
    loadMusicFoldersUI();
    loadMusicStorageList();
    document.getElementById('music-player-slide').classList.add('active');
}

function closeMusicPlayerSlide() { document.getElementById('music-player-slide').classList.remove('active'); }

function handleMusicFolderSelectChange() {
    const select = document.getElementById('music-folder-select');
    const newInput = document.getElementById('music-new-folder-input');
    newInput.style.display = (select.value === '__NEW__') ? 'block' : 'none';
    if (select.value === '__NEW__') newInput.focus(); else newInput.value = '';
}

function loadMusicFoldersUI() {
    if (!db) return;
    const tx = db.transaction("offline_music", "readonly");
    const request = tx.objectStore("offline_music").getAll();
    request.onsuccess = function() {
        const allTracks = request.result;
        const foldersSet = new Set();
        allTracks.forEach(track => { if (track.folder) foldersSet.add(track.folder); });

        const uploadSelect = document.getElementById('music-folder-select');
        const currentUploadVal = uploadSelect.value;
        uploadSelect.innerHTML = `<option value="Favorit">⭐ Favorit</option><option value="__NEW__">➕ Buat Folder Playlist Baru...</option>`;
        foldersSet.forEach(f => {
            if (f !== "Favorit") {
                const opt = document.createElement('option');
                opt.value = f; opt.innerText = "📁 " + f;
                uploadSelect.insertBefore(opt, uploadSelect.lastElementChild);
            }
        });
        uploadSelect.value = [...uploadSelect.options].some(o => o.value === currentUploadVal) ? currentUploadVal : "Favorit";
        handleMusicFolderSelectChange();
    };
}

function playMusicTemporary() {
    const input = document.getElementById('music-file-input');
    if (!input.files || input.files.length === 0) { alert("Pilih file audio (.mp3) terlebih dahulu!"); return; }
    currentActiveQueue = Array.from(input.files).map(file => ({
        title: file.name.replace(/\.[^/.]+$/, ""),
        fileData: file,
        folder: "Sementara"
    }));
    currentQueueIndex = 0;
    playCurrentQueueItem();
}

function uploadMultipleMusicToStorage() {
    const input = document.getElementById('music-file-input');
    const folderSelect = document.getElementById('music-folder-select');
    const newFolderInput = document.getElementById('music-new-folder-input');

    if (!input.files || input.files.length === 0) { alert("Pilih file audio (.mp3) terlebih dahulu!"); return; }
    let targetFolder = folderSelect.value === '__NEW__' ? (newFolderInput.value.trim() || "Favorit") : folderSelect.value;

    const tx = db.transaction("offline_music", "readwrite");
    const store = tx.objectStore("offline_music");
    Array.from(input.files).forEach(file => {
        store.add({
            title: file.name.replace(/\.[^/.]+$/, ""),
            fileName: file.name,
            fileData: file,
            folder: targetFolder,
            uploadedAt: new Date().toLocaleDateString('id-ID')
        });
    });

    tx.oncomplete = function() {
        input.value = ""; newFolderInput.value = "";
        loadMusicFoldersUI(); loadMusicStorageList();
        alert("Lagu berhasil disimpan ke internal!");
    };
}

async function downloadMusicToDeviceFolder(trackId) {
    if (!db) return;
    const tx = db.transaction("offline_music", "readonly");
    const req = tx.objectStore("offline_music").get(trackId);
    req.onsuccess = async function() {
        const record = req.result;
        if (record && record.fileData) {
            try {
                const dirHandle = await window.showDirectoryPicker();
                const xxxDir = await dirHandle.getDirectoryHandle("xxx", { create: true });
                const musicDir = await xxxDir.getDirectoryHandle("music", { create: true });
                const fileHandle = await musicDir.getFileHandle(record.fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(record.fileData);
                await writable.close();
                alert(`Lagu didownload ke folder perangkat: xxx/music/${record.fileName}`);
            } catch (err) { console.log("Download dibatalkan.", err); }
        }
    };
}

function loadMusicStorageList() {
    const container = document.getElementById('music-folder-container');
    container.innerHTML = "Memuat daftar musik...";

    if (!db) return;
    const tx = db.transaction("offline_music", "readonly");
    const request = tx.objectStore("offline_music").getAll();
    request.onsuccess = function() {
        const allTracks = request.result;
        container.innerHTML = "";
        if (allTracks.length === 0) {
            container.innerHTML = "<span style='font-size:13px; color:var(--text-muted); text-align:center; display:block; padding: 20px;'>Belum ada lagu offline tersimpan.</span>";
            return;
        }

        const grouped = {};
        allTracks.forEach(track => {
            const fName = track.folder || "Favorit";
            if (!grouped[fName]) grouped[fName] = [];
            grouped[fName].push(track);
        });

        Object.keys(grouped).sort().forEach(folderName => {
            const tracksInFolder = grouped[folderName];
            let tracksHtml = '';
            tracksInFolder.forEach(t => {
                tracksHtml += `
                    <div class="music-item-card">
                        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 1; padding-right: 10px;">
                            <span style="font-size: 18px;">🎵</span>
                            <span style="font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${t.title}">${t.title}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                            <button class="btn-pdf-action" onclick="playOfflineTrack(${t.id})">Putar</button>
                            <button class="btn-pdf-download" onclick="downloadMusicToDeviceFolder(${t.id})" title="Download ke Folder xxx/music">📥</button>
                            <button class="btn-pdf-delete" onclick="deleteMusicTrack(${t.id})">×</button>
                        </div>
                    </div>
                `;
            });

            const card = document.createElement('div');
            card.className = 'folder-accordion-card';
            card.innerHTML = `
                <div class="folder-accordion-header" onclick="toggleFolderAccordion(this)">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>📁</span><span>${folderName}</span> <span style="font-size:11px; color:var(--text-muted); font-weight:normal;">(${tracksInFolder.length} Lagu)</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button class="btn-read-folder" onclick="event.stopPropagation(); playFolderOfflineCombined('${folderName}')">▶ Putar Folder</button>
                        <span class="accordion-arrow">▼</span>
                    </div>
                </div>
                <div class="folder-content-list">${tracksHtml}</div>
            `;
            container.appendChild(card);
        });
    };
}

function playOfflineTrack(trackId) {
    if (!db) return;
    const tx = db.transaction("offline_music", "readonly");
    const req = tx.objectStore("offline_music").getAll();
    req.onsuccess = function() {
        const allTracks = req.result;
        currentActiveQueue = allTracks;
        currentQueueIndex = allTracks.findIndex(t => t.id === trackId);
        playCurrentQueueItem();
    };
}

function playFolderOfflineCombined(folderName) {
    if (!db) return;
    const tx = db.transaction("offline_music", "readonly");
    const req = tx.objectStore("offline_music").getAll();
    req.onsuccess = function() {
        currentActiveQueue = req.result.filter(t => (t.folder || "Favorit") === folderName);
        currentQueueIndex = 0;
        playCurrentQueueItem();
    };
}

function playAllMusicCombined() {
    if (!db) return;
    const tx = db.transaction("offline_music", "readonly");
    const req = tx.objectStore("offline_music").getAll();
    req.onsuccess = function() {
        currentActiveQueue = req.result;
        if (currentActiveQueue.length === 0) { alert("Belum ada lagu tersimpan."); return; }
        currentQueueIndex = 0;
        playCurrentQueueItem();
    };
}

function playCurrentQueueItem() {
    if (currentActiveQueue.length === 0 || currentQueueIndex < 0 || currentQueueIndex >= currentActiveQueue.length) return;
    const track = currentActiveQueue[currentQueueIndex];
    const floatingPlayer = document.getElementById('floating-music-player');
    const audioEl = document.getElementById('global-audio-element');

    document.getElementById('current-playing-title').innerText = track.title;
    document.getElementById('current-playing-folder').innerText = `Folder: ${track.folder || "Favorit"} (${currentQueueIndex + 1}/${currentActiveQueue.length})`;
    
    if (audioEl.src) URL.revokeObjectURL(audioEl.src);
    audioEl.src = URL.createObjectURL(track.fileData);
    floatingPlayer.classList.add('active');
    audioEl.play().catch(() => alert("Gagal memutar file audio."));
}

function playNextTrack() {
    if (currentActiveQueue.length === 0) return;
    currentQueueIndex = (currentQueueIndex + 1) % currentActiveQueue.length;
    playCurrentQueueItem();
}

function playPrevTrack() {
    if (currentActiveQueue.length === 0) return;
    currentQueueIndex = (currentQueueIndex - 1 + currentActiveQueue.length) % currentActiveQueue.length;
    playCurrentQueueItem();
}

function closeFloatingMusic() {
    const audioEl = document.getElementById('global-audio-element');
    audioEl.pause(); audioEl.src = "";
    document.getElementById('floating-music-player').classList.remove('active');
}

function deleteMusicTrack(trackId) {
    if (confirm("Hapus lagu ini dari penyimpanan offline?")) {
        const tx = db.transaction("offline_music", "readwrite");
        tx.objectStore("offline_music").delete(trackId);
        tx.oncomplete = () => { loadMusicFoldersUI(); loadMusicStorageList(); };
    }
}

// --- 6. PEMUTAR VIDEO USB / INTERNAL ---
function openVideoPlayerSlide() { closeTopMenu(); document.getElementById('video-player-slide').classList.add('active'); }
function closeVideoPlayerSlide() { document.getElementById('video-player-slide').classList.remove('active'); }

async function openFolderFromUsb() {
    try {
        const dirHandle = await window.showDirectoryPicker();
        const videoGrid = document.getElementById('video-grid-container');
        const countLabel = document.getElementById('video-count-label');
        videoGrid.innerHTML = "Memindai video & subtitle...";
        countLabel.innerText = "Memindai direktori...";

        const videoFiles = [];
        window.usbVideoCache = window.usbVideoCache || {};
        window.usbSubtitleCache = {}; 

        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file') {
                const nameLower = entry.name.toLowerCase();
                if (nameLower.match(/\.(mp4|mkv|webm|avi|mov)$/)) {
                    videoFiles.push({ name: entry.name, file: await entry.getFile() });
                } else if (nameLower.match(/\.(srt|vtt)$/)) {
                    window.usbSubtitleCache[entry.name] = await entry.getFile();
                }
            }
        }

        videoGrid.innerHTML = "";
        if (videoFiles.length === 0) { countLabel.innerText = "Tidak ditemukan file video di folder ini."; return; }
        countLabel.innerText = `Ditemukan ${videoFiles.length} file video:`;

        videoFiles.forEach((vidObj) => {
            const card = document.createElement('div');
            card.className = 'video-item-card';
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">🎬</span>
                    <span class="video-title" title="${vidObj.name}">${vidObj.name}</span>
                </div>
                <button class="btn-pdf-action" style="width: 100%; text-align: center;" onclick="playUsbVideo('${vidObj.name.replace(/'/g, "\\'")}')">Putar Video</button>
            `;
            videoGrid.appendChild(card);
            window.usbVideoCache[vidObj.name] = vidObj.file;
        });
    } catch (err) { console.log("Pemilihan folder dibatalkan.", err); }
}

async function playUsbVideo(fileName) {
    const file = window.usbVideoCache && window.usbVideoCache[fileName];
    if (!file) { alert("File video tidak ditemukan di cache."); return; }

    const activeSlide = document.getElementById('active-video-slide');
    const videoPlayer = document.getElementById('mx-video-player');
    document.getElementById('active-video-title').innerText = fileName;
    
    videoPlayer.innerHTML = '';
    if (videoPlayer.src) URL.revokeObjectURL(videoPlayer.src);
    videoPlayer.src = URL.createObjectURL(file);
    
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const matchingSubName = Object.keys(window.usbSubtitleCache || {}).find(sub => sub.toLowerCase().includes(baseName.toLowerCase()));
    
    if (matchingSubName) {
        try {
            let subText = await window.usbSubtitleCache[matchingSubName].text();
            if (matchingSubName.toLowerCase().endsWith('.srt')) {
                subText = "WEBVTT\n\n" + subText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
            }
            const subUrl = URL.createObjectURL(new Blob([subText], { type: 'text/vtt' }));
            const track = document.createElement('track');
            track.kind = 'subtitles'; track.label = matchingSubName; track.srclang = 'id'; track.src = subUrl; track.default = true; 
            videoPlayer.appendChild(track);
        } catch (err) { console.error("Gagal memuat subtitle:", err); }
    }

    const resumeKey = 'resume_vid_' + fileName;
    const savedTime = localStorage.getItem(resumeKey);
    videoPlayer.onloadedmetadata = () => { if (savedTime && parseFloat(savedTime) > 0) videoPlayer.currentTime = parseFloat(savedTime); };
    videoPlayer.ontimeupdate = () => { if (videoPlayer.currentTime > 0) localStorage.setItem(resumeKey, videoPlayer.currentTime); };

    activeSlide.classList.add('active');
    videoPlayer.play();
}

function closeActiveVideo() {
    const videoPlayer = document.getElementById('mx-video-player');
    videoPlayer.pause();
    videoPlayer.ontimeupdate = null; videoPlayer.onloadedmetadata = null;
    if (videoPlayer.src) URL.revokeObjectURL(videoPlayer.src);
    videoPlayer.src = ""; videoPlayer.innerHTML = ""; 
    document.getElementById('active-video-slide').classList.remove('active');
}

// --- 7. EVENT HANDLERS GLOBAL & MODAL ---
function closeModal() { document.getElementById('comic-modal').style.display = 'none'; }
function openAddComicModal() { document.getElementById('add-comic-modal').style.display = 'flex'; }

function closeAddComicModal() {
    document.getElementById('add-comic-modal').style.display = 'none';
    addComicForm.reset();
    suggestionsBox.style.display = 'none';
    fetchStatusEl.innerText = '';
}

addComicForm.addEventListener('submit', function (e) {
    e.preventDefault();
    comicCatalog.push({
        id: Date.now(),
        title: document.getElementById('form-title').value,
        author: document.getElementById('form-author').value,
        totalVolumes: parseInt(document.getElementById('form-total-vol').value) || 1,
        type: document.querySelector('input[name="comic-type"]:checked').value
    });
    localStorage.setItem('myComicCatalogFinalTextOnly', JSON.stringify(comicCatalog));
    closeAddComicModal();
    renderComics();
});

function deleteComic(event, id) {
    event.stopPropagation();
    if (confirm("Hapus komik ini dari katalog?")) {
        comicCatalog = comicCatalog.filter(c => c.id !== id);
        localStorage.setItem('myComicCatalogFinalTextOnly', JSON.stringify(comicCatalog));
        delete ownedVolumesData[id];
        localStorage.setItem('ownedVolumesDataFinalTextOnly', JSON.stringify(ownedVolumesData));
        renderComics();
    }
}

window.onclick = function (event) {
    closeTopMenu();
    if (event.target == document.getElementById('add-comic-modal')) closeAddComicModal();
    if (event.target == document.getElementById('comic-modal')) closeModal();
};

searchInput.addEventListener('input', renderComics);
renderComics();

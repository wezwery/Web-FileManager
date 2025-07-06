const API_URL = `${location.protocol}//${location.hostname}:3000/api`;
const USED_FILES = ['notes.txt'];
const FOLDER_ICON = '📁';
const FILE_ICON = '📄';
const IMAGE_ICON = '🖼️';
const AUDIO_ICON = '💽';
const VIDEO_ICON = '📼';
const ARCHIVE_ICON = '📦';

let currentPath = '/';

function isImage(ext) {
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
}
function isAudio(ext) {
    return ['mp3', 'wav', 'ogg'].includes(ext);
}
function isVideo(ext) {
    return ['mp4', 'avi', 'mkv', 'mov'].includes(ext);
}
function isText(ext) {
    return ['txt', 'json'].includes(ext);
}
function isArchive(ext) {
    return ['zip', 'ico', 'rar', '7z', 'tar'].includes(ext);
}

function normalizePath(path) {
    if (!path) return '/';
    let normalized = path.replace(/\/+/g, '/'); // заменяем // на /
    if (!normalized.endsWith('/')) {
        normalized += '/';
    }
    return normalized;
}

function getParentPath(path) {
    const normalized = normalizePath(path);
    if (normalized === '/') return '/';
    const parts = normalized.split('/').filter(p => p); // удаляем пустые сегменты
    parts.pop(); // убираем последний сегмент
    const parent = '/' + parts.join('/') + (parts.length ? '/' : '');
    return parent;
}

function showImageViewer(fileName, src) {
    hideViewers();
    document.getElementById('image-viewer').style.display = 'block';
    document.getElementById('viewer-file-name').innerText = fileName;
    document.getElementById('image-viewer-img').src = src;
}

function showTextViewer(fileName, src) {
    hideViewers();
    document.getElementById('text-viewer').style.display = 'block';
    document.getElementById('viewer-file-name').innerText = fileName;
    fetch(src)
        .then(res => res.text())
        .then(text => {
            document.getElementById('text-viewer-txt').textContent = text;
        });
}

function hideViewers() {
    document.getElementById('viewer-file-name').innerText = "";
    document.getElementById('image-viewer').style.display = 'none';
    document.getElementById('text-viewer').style.display = 'none';
}

// Загрузка каталога
async function loadFiles(path = '/') {
    currentPath = normalizePath(path);
    document.getElementById('path-input').value = currentPath;
    const response = await fetch(`${API_URL}/files?path=${encodeURIComponent(path)}`);
    const files = await response.json();
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';

    // Кнопка "Назад" если мы не в корне
    if (currentPath !== '/') {
        const upDiv = document.createElement('div');
        upDiv.className = 'file';
        upDiv.textContent = '⬆️ ..';
        upDiv.onclick = () => {
            const parentPath = getParentPath(currentPath);
            loadFiles(parentPath);
        };
        fileList.appendChild(upDiv);
    }

    document.getElementById('notes').style.display = 'none';

    hideViewers();

    files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file';

        if (file.isDirectory) {
            div.textContent = `${FOLDER_ICON} ${file.name}`;
        }
        else {
            const ext = file.name.split('.').pop().toLowerCase();

            if (isAudio(ext)) {
                div.textContent = `${AUDIO_ICON} ${file.name}`;
            } else if (isVideo(ext)) {
                div.textContent = `${VIDEO_ICON} ${file.name}`;
            } else if (isImage(ext)) {
                div.textContent = `${IMAGE_ICON} ${file.name}`;
                div.onclick = (e) => {
                    e.stopPropagation();
                    showImageViewer(file.name, `${API_URL}/download?path=${encodeURIComponent(currentPath + file.name)}`);
                };
            } else if (isArchive(ext)) {
                div.textContent = `${ARCHIVE_ICON} ${file.name}`;
            }
            else {
                div.textContent = `${FILE_ICON} ${file.name}`;

                if (isText(ext)) {
                    div.onclick = (e) => {
                        e.stopPropagation();
                        showTextViewer(file.name, `${API_URL}/download?path=${encodeURIComponent(currentPath + file.name)}`);
                    };
                }
            }

            if (USED_FILES.includes(file.name))
                div.style.opacity = '50%';
        }

        const actions = document.createElement('div');

        // Переход внутрь папки
        if (file.isDirectory) {
            div.onclick = () => {
                const newPath = normalizePath(`${currentPath}${file.name}`);
                loadFiles(newPath);
            };
            const downloadZipBtn = document.createElement('button');
            downloadZipBtn.textContent = '📦 Скачать ZIP';
            downloadZipBtn.onclick = (e) => {
                e.stopPropagation();
                downloadFile(`${currentPath}${file.name}`);
            };
            actions.appendChild(downloadZipBtn);
        } else {
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = '⬇️ Скачать';
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadFile(`${currentPath}${file.name}`);
            };
            actions.appendChild(downloadBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️ Удалить';
        deleteBtn.classList.add('delete');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFile(`${path}${file.name}`);
        };

        actions.appendChild(deleteBtn);

        div.appendChild(actions);

        fileList.appendChild(div);
    });

    await getNotes(path);
}

// Получить заметки каталога
async function getNotes(directory) {
    const response = await fetch(`${API_URL}/notes?path=${encodeURIComponent(directory)}`, {
        method: 'GET'
    });

    const result = await response.json();
    if (result.error) {
        alert(`Ошибка: ${result.error}`);
    }

    if (result.message) {
        document.getElementById('notes').style.display = 'flex';
        document.getElementById('notes').innerText = result.message;
    }
    else
        document.getElementById('notes').style.display = 'none';
}

// Скачивание файла
function downloadFile(filePath) {
    const url = `${API_URL}/download?path=${encodeURIComponent(filePath)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filePath.split('/').pop(); // имя файла
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Удаление каталога
async function deleteFile(filePath) {
    if (confirm(`Удалить ${filePath}?`)) {
        const response = await fetch(`${API_URL}/files?path=${encodeURIComponent(filePath)}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        if (result.error) {
            alert(`Ошибка: ${result.error}`);
        }

        refreshCurrentFolder(); // обновляем список
    }
}

// Создание каталога
async function createFolder() {
    const folderName = prompt('Введите имя новой папки:');
    if (folderName) {
        const response = await fetch(`${API_URL}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: `${currentPath}${folderName}`, type: 'folder' })
        });

        const result = await response.json();
        if (result.error) {
            alert(`Ошибка: ${result.error}`);
        }

        refreshCurrentFolder();
    }
}

// Создание файла
async function createFile() {
    const fileName = prompt('Введите имя нового файла:');
    if (fileName) {
        const response = await fetch(`${API_URL}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: `${currentPath}${fileName}`, type: 'file' })
        });

        const result = await response.json();
        if (result.error) {
            alert(`Ошибка: ${result.error}`);
        }

        refreshCurrentFolder();
    }
}

// Отправка файла
async function uploadFile(file, destination) {
    if (!file || !destination) return;

    const fileData = new FormData();
    fileData.append('file', file);

    // Показать прогресс
    const progressContainer = document.getElementById('upload-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = `0% (${file.name})`;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_URL}/upload?destination=${destination}`);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percent + '%';
                progressText.textContent = `${percent}% (${file.name})`;
            }
        });

        xhr.onload = () => {
            if (xhr.status === 200) {
                progressBar.style.width = '100%';
                progressText.textContent = `✅ Загружено: ${file.name}`;
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 800);
                resolve();
            } else {
                alert(`Ошибка при загрузке ${file.name}: ${xhr.responseText}`);
                progressContainer.style.display = 'none';
                reject();
            }
        };

        xhr.onerror = () => {
            alert(`Ошибка сети при загрузке ${file.name}`);
            progressContainer.style.display = 'none';
            reject();
        };

        xhr.send(fileData);
    });
}

// Обновить текущий каталог
function refreshCurrentFolder() {
    loadFiles(currentPath);
}

// Переход к пути из input
function goToPath() {
    const newPath = document.getElementById('path-input').value || '/';
    loadFiles(newPath);
}

// Добавляем обработку Enter
document.getElementById('path-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        goToPath();
    }
});

document.getElementById('upload-btn').addEventListener('click', () => {
    document.getElementById('upload-input').click();
});

document.getElementById('upload-input').addEventListener('change', async () => {
    const input = document.getElementById('upload-input');
    if (!input.files || input.files.length < 1) return;

    for (let index = 0; index < input.files.length; index++) {
        const file = input.files[index];
        await uploadFile(file, currentPath);
    }

    input.value = ''; // сбросить выбор файла

    refreshCurrentFolder();
});

const dropZone = document.getElementById('drop-zone');

// Предотвращаем дефолтное поведение браузера
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => e.preventDefault());
    dropZone.addEventListener(eventName, (e) => e.stopPropagation());
});

// Подсвечиваем зону при наведении
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'));
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'));
});

// Обработка drop файлов
dropZone.addEventListener('drop', async (e) => {
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (let file of files) {
        await uploadFile(file, currentPath);
    }

    refreshCurrentFolder();
});

// Загрузка файлов при старте
loadFiles();

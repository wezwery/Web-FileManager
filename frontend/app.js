const API_URL = `${location.protocol}//${location.hostname}:3000/api`;
const FOLDER_ICON = '📁';
const FILE_ICON = '📄';
const IMAGE_ICON = '🖼️';
const AUDIO_ICON = '💽';
const VIDEO_ICON = '📼';

let currentPath = '/';

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

    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file';

        if (file.isDirectory) {
            div.textContent = `${FOLDER_ICON} ${file.name}`;
        }
        else {
            const ext = file.name.split('.').pop().toLowerCase();

            if (['mp3', 'wav', 'ogg'].includes(ext)) {
                div.textContent = `${AUDIO_ICON} ${file.name}`;
            } else if (['mp4', 'avi', 'mkv', 'mov'].includes(ext)) {
                div.textContent = `${VIDEO_ICON} ${file.name}`;
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
                div.textContent = `${IMAGE_ICON} ${file.name}`;
            } else {
                div.textContent = `${FILE_ICON} ${file.name}`;
            }
        }

        const actions = document.createElement('div');

        // Переход внутрь папки
        if (file.isDirectory) {
            div.onclick = () => {
                const newPath = normalizePath(`${currentPath}${file.name}`);
                loadFiles(newPath);
            };
        }

        // Кнопка скачивания только для файлов
        if (!file.isDirectory) {
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

        refreshCurrent(); // обновляем список
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

        refreshCurrent();
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

        refreshCurrent();
    }
}

// Отправка файла
async function uploadFile(file, destination) {
    if (!file || !destination) return;

    const fileData = new FormData();
    fileData.append('file', file); // сам файл

    const response = await fetch(`${API_URL}/upload?destination=${destination}`, {
        method: 'POST',
        body: fileData
    });

    const result = await response.json();
    if (result.error) {
        alert(`Ошибка: ${result.error}`);
    }
    refreshCurrent();
}

// Обновить текущий каталог
function refreshCurrent() {
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

    alert('Файл(ы) отправлены');
});

// Загрузка файлов при старте
loadFiles();

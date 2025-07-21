const API_URL = `${location.protocol}//${location.hostname}:3000/api`;
const USED_FILES = ['notes.txt'];
const FOLDER_ICON = '📁';
const FILE_ICON = '📄';
const IMAGE_ICON = '🖼️';
const AUDIO_ICON = '💽';
const VIDEO_ICON = '📼';
const ARCHIVE_ICON = '📦';

const DROP_ZONE = document.getElementById('drop-zone');

let currentPath = '/';

// Форматы файлов
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
    return ['txt', 'json', 'md'].includes(ext);
}
function isArchive(ext) {
    return ['zip', 'ico', 'rar', '7z', 'tar'].includes(ext);
}
//

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

function getSizeString(size) {
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} КБ`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} МБ`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

function getFileExtension(fileName) {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function getNameString(file) {
    var name = file.name;

    if (name.length > 40) {
        name = name.slice(0, 40) + '...' + getFileExtension(file.name);
    }

    if (file.isDirectory) {
        return `${FOLDER_ICON} ${name}`;
    }

    const ext = getFileExtension(name);
    if (isImage(ext)) {
        return `${IMAGE_ICON} ${name}`;
    } else if (isAudio(ext)) {
        return `${AUDIO_ICON} ${name}`;
    } else if (isVideo(ext)) {
        return `${VIDEO_ICON} ${name}`;
    } else if (isArchive(ext)) {
        return `${ARCHIVE_ICON} ${name}`;
    }

    return `${FILE_ICON} ${name}`;
}

function createTemplate(templateId) {
    const template = document.getElementById(templateId);
    if (!template) {
        console.error(`Template with id ${templateId} not found`);
        return null;
    }
    return template.content.cloneNode(true);
}

// Просмотрщики
function scrollToViewers() {
    document.getElementById('viewers').scrollIntoView({ behavior: 'smooth' });
}

function showImageViewer(fileName, src) {
    hideViewers();
    document.getElementById('viewers').style.display = 'block';
    document.getElementById('image-viewer').style.display = 'block';
    document.getElementById('viewer-file-name').innerText = fileName;
    document.getElementById('image-viewer-img').onload = () => {
        scrollToViewers();
    };
    document.getElementById('image-viewer-img').src = src;
}

function showTextViewer(fileName, src) {
    hideViewers();
    document.getElementById('viewers').style.display = 'block';
    document.getElementById('text-viewer').style.display = 'block';
    document.getElementById('viewer-file-name').innerText = fileName;
    fetch(src)
        .then(res => res.text())
        .then(text => {
            document.getElementById('text-viewer-txt').textContent = text;
            scrollToViewers();
        });
}

function hideViewers() {
    document.getElementById('viewers').style.display = 'none';
    document.getElementById('viewer-file-name').innerText = '';
    document.getElementById('image-viewer').style.display = 'none';
    document.getElementById('text-viewer').style.display = 'none';
}
//

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
        const fragment = createTemplate('file-template');
        const fileItem = fragment.querySelector('.file-item');
        const name = fileItem.querySelector('.file-name');
        const info = fileItem.querySelector('.file-info');

        name.textContent = '⬆️ ..';
        info.style.display = "none";

        fileItem.onclick = () => {
            const parentPath = getParentPath(currentPath);
            loadFiles(parentPath);
        };

        fileList.appendChild(fragment);
    }

    document.getElementById('notes').style.display = 'none';

    hideViewers();

    DROP_ZONE.style.display = "none";

    await getNotes(path);

    files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return getFileExtension(a.name).localeCompare(getFileExtension(b.name), undefined, { numeric: true, sensitivity: 'base' });
    });

    files.forEach(file => {
        const fragment = createTemplate('file-template');
        const fileItem = fragment.querySelector('.file-item');
        const name = fileItem.querySelector('.file-name');
        const actions = fileItem.querySelector('.file-actions');
        const infoSize = fileItem.querySelector('.file-size');
        const infoModified = fileItem.querySelector('.file-date');

        name.textContent = getNameString(file);

        if (!file.isDirectory) {
            const ext = getFileExtension(file.name);
            if (isImage(ext)) {
                console.log(`Добавление обработчика для изображения: ${file.name}`);
                fileItem.onclick = (e) => {
                    console.log(`Открытие изображения: ${file.name}`);
                    e.stopPropagation();
                    showImageViewer(file.name, `${API_URL}/download?path=${encodeURIComponent(currentPath + file.name)}`);
                };
            } else if (isText(ext)) {
                console.log(`Добавление обработчика для текста: ${file.name}`);
                fileItem.onclick = (e) => {
                    console.log(`Открытие текста: ${file.name}`);
                    e.stopPropagation();
                    showTextViewer(file.name, `${API_URL}/download?path=${encodeURIComponent(currentPath + file.name)}`);
                };
            }

            if (USED_FILES.includes(file.name))
                fileItem.style.opacity = '50%';
        }
        else {
            fileItem.onclick = () => {
                const newPath = normalizePath(`${currentPath}${file.name}`);
                loadFiles(newPath);
            };
        }

        const renameBtn = document.createElement('button');

        renameBtn.textContent = '✏️ Переименовать';
        renameBtn.classList.add('rename');
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            renameFile(file.name, `${path}${file.name}`);
        };

        actions.appendChild(renameBtn);

        const downloadBtn = document.createElement('button');

        if (file.isDirectory) {
            downloadBtn.textContent = '📦 Скачать ZIP';
        } else {
            downloadBtn.textContent = '⬇️ Скачать';
        }

        downloadBtn.onclick = (e) => {
            e.stopPropagation();
            downloadFile(`${currentPath}${file.name}`);
        };
        actions.appendChild(downloadBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑️ Удалить';
        deleteBtn.classList.add('delete');
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFile(`${path}${file.name}`);
        };

        actions.appendChild(deleteBtn);

        if (!file.isDirectory) {
            infoSize.textContent = getSizeString(file.size);
        }
        infoModified.textContent = new Date(file.modified).toLocaleString();

        fileList.appendChild(fragment);
    });

    DROP_ZONE.style.display = "block";
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

// Переименование каталога
async function renameFile(oldName, filePath) {
    const newName = prompt('Введите новое название:', oldName);
    if (newName) {
        const response = await fetch(`${API_URL}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath, name: newName })
        });

        const result = await response.json();
        if (result.error) {
            alert(`Ошибка: ${result.error}`);
        }

        refreshCurrentFolder();
    }
}

// Создание каталога
async function createFolder() {
    const folderName = prompt('Введите название новой папки:');
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
    const fileName = prompt('Введите название нового файла:');
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

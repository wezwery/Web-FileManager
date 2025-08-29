const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const archiver = require('archiver');
const busboy = require('busboy');

const app = express();
const PORT = 3000;

const ROOT_DIR = path.resolve(__dirname, '..'); // корневая директория

const DIR_PATH = path.join(ROOT_DIR, "data/"); // путь к каталогу

if (!fs.existsSync(DIR_PATH))
    fs.mkdirSync(DIR_PATH);

app.use(cors());
app.use(express.json());

// Проверка, что путь не выходит за DIR_PATH
function isPathInsideRoot(fullPath) {
    const resolvedRoot = path.resolve(DIR_PATH) + path.sep; // гарантируем / на конце
    const resolvedTarget = path.resolve(fullPath) + path.sep;

    const accept = resolvedTarget.startsWith(resolvedRoot);

    // console.log(`[Защита каталога] [${accept}] Проверка пути: ${resolvedTarget} в ${resolvedRoot}`);

    return accept;
}

// Получение списка файлов и папок
app.get('/api/files', (req, res) => {
    const dirPath = path.join(DIR_PATH, req.query.path || '/');
    if (!isPathInsideRoot(dirPath)) {
        res.status(400).json({ error: 'Неверный путь' });
        return;
    }
    fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
        if (err) return res.status(500).json({ error: 'Ошибка чтения директории' });
        const result = files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory(),
            size: fs.statSync(path.join(dirPath, file.name)).size,
            modified: fs.statSync(path.join(dirPath, file.name)).mtime
        }));
        res.json(result);
        console.log(`Файлы получены: ${req.query.path || '/'}`);
    });
});

// Удаление файла или папки
app.delete('/api/files', (req, res) => {
    const targetPath = path.join(DIR_PATH, req.query.path || '');
    if (!isPathInsideRoot(targetPath)) {
        res.status(400).json({ error: 'Неверный путь' });
        return;
    }
    fs.stat(targetPath, (err, stats) => {
        if (err) return res.status(404).json({ error: 'Файл не найден' });
        if (stats.isDirectory()) {
            fs.rm(targetPath, { recursive: true, force: true }, err => {
                if (err) return res.status(500).json({ error: 'Ошибка удаления папки' });
                res.json({ message: 'Папка удалена' });
                console.log(`Папка удалена: ${req.query.path || ''}`);
            });
        } else {
            fs.unlink(targetPath, err => {
                if (err) return res.status(500).json({ error: 'Ошибка удаления файла' });
                res.json({ message: 'Файл удален' });
                console.log(`Файл удален: ${req.query.path || ''}`);
            });
        }
    });
});

// Переименование файла или папки
app.post('/api/rename', (req, res) => {
    const { path: targetPath, name } = req.body;

    const oldPath = path.join(DIR_PATH, targetPath);
    const newPath = path.join(path.dirname(oldPath), name);

    if (!isPathInsideRoot(oldPath) || !isPathInsideRoot(newPath)) {
        res.status(400).json({ error: 'Неверный путь' });
        return;
    }

    fs.rename(oldPath, newPath, err => {
        if (err) return res.status(500).json({ error: 'Ошибка переименования' });
        res.json({ message: 'Переименование успешно' });

        console.log(`Переименовано ${oldPath} на ${newPath}`);
    });
})

// Создание файла или папки
app.post('/api/files', (req, res) => {
    const { path: targetPath, type } = req.body;

    const fullPath = path.join(DIR_PATH, targetPath);

    if (!isPathInsideRoot(fullPath)) {
        res.status(400).json({ error: 'Неверный путь' });
        return;
    }

    if (type === 'folder') {
        fs.mkdir(fullPath, { recursive: false }, err => {
            if (err) return res.status(500).json({ error: 'Ошибка создания папки' });
            res.json({ message: 'Папка создана' });
            console.log(`Папка создана: ${targetPath}`);
        });
    } else if (type === 'file') {
        fs.writeFile(fullPath, '', err => {
            if (err) return res.status(500).json({ error: 'Ошибка создания файла' });
            res.json({ message: 'Файл создан' });
            console.log(`Файл создан: ${targetPath}`);
        });
    } else {
        res.status(400).json({ error: 'Неверный тип. Используйте "file" или "folder".' });
    }
});

// Отправка файла
app.post('/api/upload', (req, res) => {
    const bb = busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024 * 1024 } }); // 5GB

    bb.on('file', (name, file, info) => {
        const { filename } = info;
        const saveTo = path.join(DIR_PATH, req.query.destination || '/', filename);

        if (!isPathInsideRoot(saveTo)) {
            return res.status(400).json({ error: 'Неверный путь' });
        }

        fs.mkdirSync(path.dirname(saveTo), { recursive: true });
        const writeStream = fs.createWriteStream(saveTo);

        file.pipe(writeStream);

        file.on('data', (data) => {
            // Можем логировать прогресс (для WebSocket прогресс бара)
            console.log(`[Загрузка файла на сервер] [${filename}] Получено ${data.length} байт`);
        });

        file.on('end', () => {
            console.log(`[Загрузка файла на сервер] ✅ Файл ${filename} загружен`);
        });

        writeStream.on('close', () => {
            res.status(200).json({ message: 'Файл успешно загружен', file: filename });
        });

        writeStream.on('error', (err) => {
            console.error('Ошибка записи файла:', err);
            res.status(500).json({ error: 'Ошибка загрузки файла' });
        });
    });

    bb.on('error', (err) => {
        console.error('Ошибка загрузки:', err);
        res.status(500).json({ error: 'Ошибка загрузки файла' });
    });

    req.pipe(bb);
});

app.get('/api/notes', (req, res) => {
    const filePath = path.join(DIR_PATH, (req.query.path || '') + "notes.txt");
    if (!isPathInsideRoot(filePath)) {
        res.status(400).json({ error: 'Неверный путь' });
        return;
    }

    let notes = "";
    if (fs.existsSync(filePath)) {
        notes = fs.readFileSync(filePath, 'utf-8');
        console.log(`Заметки получены: ${filePath}`);
    }

    res.json({ message: notes });
})

// Скачивание файла или папки (как zip)
app.get('/api/download', (req, res) => {
    const filePath = path.join(DIR_PATH, req.query.path || '');
    if (!isPathInsideRoot(filePath)) {
        res.status(400).json({ error: 'Неверный путь' });
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            return res.status(404).json({ error: 'Файл или папка не найдены' });
        }

        if (stats.isFile()) {
            // Скачиваем файл
            res.download(filePath, err => {
                if (err) res.status(500).json({ error: 'Ошибка скачивания файла' });
                console.log(`Файл скачан: ${filePath}`);
            });
        } else if (stats.isDirectory()) {
            // Скачиваем папку как zip
            const folderName = path.basename(filePath);
            res.setHeader('Content-Type', 'application/zip');

            const encodedName = encodeURIComponent(folderName + '.zip');
            res.setHeader('Content-Disposition', `attachment; filename="${encodedName}.zip"; filename*=UTF-8''${encodedName}`);

            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.directory(filePath, false);
            archive.pipe(res);

            archive.finalize().catch(err => {
                console.error(err);
                res.status(500).json({ error: 'Ошибка архивации' });
            }).finally(() => {
                console.log(`Папка скачана: ${filePath}`);
            });
        } else {
            res.status(400).json({ error: 'Недопустимый тип' });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
});
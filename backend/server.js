const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const archiver = require('archiver');

const app = express();
const PORT = 3000;

const ROOT_DIR = path.resolve(__dirname, '..'); // корневая директория

const DIR_PATH = path.join(ROOT_DIR, "data/");

app.use(cors());
app.use(express.json());

// Проверка, что путь не выходит за ROOT_DIR
function isPathInsideRoot(fullPath) {
    const resolvedRoot = path.resolve(ROOT_DIR) + path.sep; // гарантируем / на конце
    const resolvedTarget = path.resolve(fullPath);

    // console.log(`Проверка путей: ${resolvedTarget} (${resolvedRoot})`);

    return resolvedTarget.startsWith(resolvedRoot);
}

// Настройка папки для сохранения загруженных файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fullPath = path.join(DIR_PATH, req.query.destination || '/');

        if (!isPathInsideRoot(fullPath))
            return;

        // Создаём папку если её нет
        fs.mkdirSync(fullPath, { recursive: true });

        cb(null, fullPath); // сюда multer будет сохранять файл
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // имя файла как у оригинала
    }
});

const upload = multer({ storage: storage });

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
            isDirectory: file.isDirectory()
        }));
        res.json(result);
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
            });
        } else {
            fs.unlink(targetPath, err => {
                if (err) return res.status(500).json({ error: 'Ошибка удаления файла' });
                res.json({ message: 'Файл удален' });
            });
        }
    });
});

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
        });
    } else if (type === 'file') {
        fs.writeFile(fullPath, '', err => {
            if (err) return res.status(500).json({ error: 'Ошибка создания файла' });
            res.json({ message: 'Файл создан' });
        });
    } else {
        res.status(400).json({ error: 'Неверный тип. Используйте "file" или "folder".' });
    }
});

// Отправка файла
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не был загружен' });
    }
    res.json({ message: 'Файл успешно загружен', file: req.file.filename });
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
            });
        } else if (stats.isDirectory()) {
            // Скачиваем папку как zip
            const folderName = path.basename(filePath);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename=${folderName}.zip`);

            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.directory(filePath, false);
            archive.pipe(res);

            archive.finalize().catch(err => {
                console.error(err);
                res.status(500).json({ error: 'Ошибка архивации' });
            });
        } else {
            res.status(400).json({ error: 'Недопустимый тип' });
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
});
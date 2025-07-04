const express = require('express');
const fs = require('fs');
const path = require('path');
const data_path = "data";
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = 3000;

const ROOT_DIR = path.resolve(__dirname, '..'); // корневая директория

app.use(cors());
app.use(express.json());

// Настройка папки для сохранения загруженных файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fullPath = path.join(ROOT_DIR, data_path + (req.query.destination || '/'));

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
    const dirPath = path.join(ROOT_DIR, data_path + (req.query.path || '/'));
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
    if (!req.query.path) {
        res.json({ message: 'Неверный путь' });
        return;
    }
    const targetPath = path.join(ROOT_DIR, data_path + (req.query.path || ''));
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
    const fullPath = path.join(ROOT_DIR, data_path + targetPath);

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

// Скачивание файла
app.get('/api/download', (req, res) => {
    if (!req.query.path) {
        res.json({ message: 'Неверный путь' });
        return;
    }
    const filePath = path.join(ROOT_DIR, data_path + (req.query.path || ''));
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            return res.status(404).json({ error: 'Файл не найден или это не файл' });
        }
        res.download(filePath, err => {
            if (err) res.status(500).json({ error: 'Ошибка скачивания файла' });
        });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на http://0.0.0.0:${PORT}`);
});
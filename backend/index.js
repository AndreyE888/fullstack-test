const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const items = new Map();

let pendingIds = new Set();

let serverState = {
    selectedIds: []
};

// Заполняю 1 млн элементов
for (let i = 1; i <= 1000000; i++) {
    items.set(i, { id: i, selected: false, order: i });
}

app.get('/items', (req, res) => {
    const filter = req.query.filter || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const all = Array.from(items.values()).sort((a, b) => a.id - b.id);
    const filtered = all.filter(item => item.id.toString().includes(filter));

    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + limit);

    res.json({
        total: filtered.length,
        page,
        limit,
        data: paginated
    });
});

app.post('/items/pending', (req, res) => {
    const { id } = req.body;

    if (!id || typeof id !== 'number') {
        return res.status(400).json({ error: 'ID должен быть числом' });
    }

    if (pendingIds.has(id) || items.has(id)) {
        return res.status(400).json({ error: 'Элемент с таким ID уже в очереди или существует' });
    }

    pendingIds.add(id);
    res.status(202).json({ message: 'Добавлено в очередь' });
});

// Получить текущее состояние выбранных
app.get('/state', (req, res) => {
    res.json(serverState);
});

// Обновить состояние выбранных
app.post('/state', (req, res) => {
    const { selectedIds } = req.body;
    if (!Array.isArray(selectedIds)) {
        return res.status(400).json({ error: 'selectedIds должен быть массивом' });
    }
    serverState = { selectedIds };
    res.json({ ok: true });
});

//Проверка сервера
app.get('/', (req, res) => {
    res.send('Бэкенд работает');
});

//Батчинг добавления (раз в 10 сек)
setInterval(() => {
    if (pendingIds.size === 0) return;

    console.log('Обработка очереди добавления:', Array.from(pendingIds));

    pendingIds.forEach(id => {
        if (!items.has(id)) {
            items.set(id, { id, selected: false, order: items.size + 1 });
        }
    });

    pendingIds.clear();
}, 10000);



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Сервер на порту ${PORT}`);
});
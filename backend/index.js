const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Хранилище данных
const items = new Map();

// Очередь на добавление
let pendingIds = new Set();

// Состояние выбранных элементов
let serverState = {
    selectedIds: []
};

// Заполняем 1 млн элементов (для теста 100)
for (let i = 1; i <= 100; i++) {
    items.set(i, { id: i, selected: false, order: i });
}

// Получить элементы с пагинацией и фильтром
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

// Добавить элемент в очередь
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

// Проверка сервера
app.get('/', (req, res) => {
    res.send('Бэкенд работает');
});

// ---- Батчинг добавления (раз в 10 сек) ----
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

// ---- Батчинг состояния (раз в 1 сек) ----
// Сейчас состояние уже обновляется через POST /state
// Можно добавить рассылку всем клиентам, если нужно
setInterval(() => {
    // Здесь можно будет добавить логику для long polling или WebSockets
    // Пока просто заглушка
}, 1000);


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Сервер на порту ${PORT}`);
});
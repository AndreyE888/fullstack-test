import { useEffect, useState } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Компонент для перетаскиваемого элемента
function SortableItem({ item, onRemove }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        padding: '4px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: isDragging ? '#f0f0f0' : 'white',
    }

    return (
        <div ref={setNodeRef} style={style}>
            <span {...attributes} {...listeners} style={{ cursor: 'grab', flex: 1 }}>
                ID: {item.id}
            </span>

            <button
                onClick={(e) => {
                    console.log('SortableItem render:', item)
                    console.log('SortableItem click, item.id:', item.id)
                    e.stopPropagation()
                    onRemove(item.id)
                }}
            >
                Убрать
            </button>
        </div>
    )
}

function App() {
    const [items, setItems] = useState([])
    const [tempItems, setTempItems] = useState([])
    const [selected, setSelected] = useState([])
    const [filter, setFilter] = useState('')
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const [newId, setNewId] = useState('')
    const [rightFilter, setRightFilter] = useState('')

    const [rightPage, setRightPage] = useState(1)
    const [rightLoading, setRightLoading] = useState(false)

    const loadItems = async (reset = false) => {
        if (loading) return
        setLoading(true)

        try {
            const currentPage = reset ? 1 : page
            const res = await fetch(`${API_URL}/items?filter=${filter}&page=${currentPage}&limit=20`)
            const data = await res.json()

            if (reset) {
                setItems(data.data)
                setPage(2)
            } else {
                setItems(prev => {
                    const newItems = [...prev, ...data.data]
                    const unique = Array.from(new Map(newItems.map(item => [item.id, item])).values())
                    return unique
                })
                setPage(prev => prev + 1)
            }

            setHasMore(data.data.length === 20)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setPage(1)
        loadItems(true)
    }, [filter])

    useEffect(() => {
        const loadState = async () => {
            try {
                const res = await fetch(`${API_URL}/state`)
                const data = await res.json()
                if (data.selectedIds.length > 0) {
                    setSelected(data.selectedIds)
                }
            } catch (err) {
                console.error(err)
            }
        }

        if (items.length > 0) {
            loadState()
        }
    }, [items])

    useEffect(() => {
        if (selected.length === 0) return

        const saveState = async () => {
            try {
                await fetch(`${API_URL}/state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ selectedIds: selected })
                })
            } catch (err) {
                console.error(err)
            }
        }

        saveState()
    }, [selected])

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_URL}/items?filter=${filter}&page=1&limit=20`)
                const data = await res.json()

                setTempItems(prev =>
                    prev.filter(temp => !data.data.some(real => real.id === temp.id))
                )

                const stateRes = await fetch(`${API_URL}/state`)
                const stateData = await stateRes.json()
                if (stateData.selectedIds.length > 0) {
                    setSelected(stateData.selectedIds)
                }
            } catch (err) {
                console.error('Ошибка при автообновлении:', err)
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [filter])

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target
        const bottom = scrollHeight - scrollTop <= clientHeight + 5

        if (bottom && hasMore && !loading) {
            loadItems()
        }
    }

    const selectItem = (item) => {
        if (!selected.includes(item.id)) {
            setSelected([...selected, item.id])
        }
    }

    const removeItem = (id) => {
        const newSelected = selected.filter(i => i !== id)
        setSelected(newSelected)

        fetch(`${API_URL}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedIds: newSelected })
        }).catch(err => console.error(err))
    }

    const handleDragEnd = (event) => {
        const { active, over } = event
        if (active.id !== over.id) {
            const oldIndex = selected.indexOf(active.id)
            const newIndex = selected.indexOf(over.id)
            const newSelected = [...selected]
            const [moved] = newSelected.splice(oldIndex, 1)
            newSelected.splice(newIndex, 0, moved)
            setSelected(newSelected)
        }
    }

    const addNewItem = async () => {
        const id = parseInt(newId)
        if (isNaN(id)) {
            alert('Введите число')
            return
        }

        try {
            const res = await fetch(`${API_URL}/items/pending`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            })

            if (!res.ok) {
                const err = await res.json()
                alert(err.error)
                return
            }

            setItems(prev => [...prev, { id, selected: false }])
            setNewId('')
            alert('Элемент добавлен в очередь')
        } catch (err) {
            console.error(err)
        }
    }

    useEffect(() => {
        setRightPage(1)
    }, [rightFilter, selected])

    const allItems = [...tempItems, ...items]
    const availableItems = allItems.filter(
        item => !selected.includes(item.id)
    )

    const allFiltered = selected
        .map(id => {
            const found = items.find(item => item.id === id)
            return found || { id }
        })
        .filter(item => item.id.toString().includes(rightFilter))

    const paginatedSelected = allFiltered.slice(0, rightPage * 20)
    const rightHasMore = allFiltered.length > paginatedSelected.length

    const loadRightItems = () => {
        if (rightLoading || !rightHasMore) return
        setRightLoading(true)
        setTimeout(() => {
            setRightPage(prev => prev + 1)
            setRightLoading(false)
        }, 300)
    }

    const handleRightScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target
        const bottom = scrollHeight - scrollTop <= clientHeight + 5

        if (bottom && rightHasMore && !rightLoading) {
            loadRightItems()
        }
    }

    console.log('selected (full):', selected)
    console.log('allFiltered:', allFiltered.map(i => i.id))
    console.log('paginatedSelected:', paginatedSelected.map(i => i.id))
    console.log('rightFilter:', rightFilter)

    return (
        <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
            <div style={{ flex: 1 }}>
                <h3>Левое окно</h3>
                <div style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        placeholder="ID нового элемента"
                        value={newId}
                        onChange={(e) => setNewId(e.target.value)}
                    />
                    <button onClick={addNewItem}>Добавить</button>
                </div>
                <input
                    type="text"
                    placeholder="Фильтр по ID"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />

                <div
                    style={{ height: '400px', overflowY: 'auto', border: '1px solid #ccc', marginTop: '10px' }}
                    onScroll={handleScroll}
                >
                    {availableItems.length === 0 && !loading && <div style={{ padding: '10px' }}>Нет элементов</div>}
                    {availableItems.map(item => (
                        <div key={item.id} style={{ padding: '4px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                            <span>ID: {item.id}</span>
                            <button onClick={() => selectItem(item)}>Выбрать</button>
                        </div>
                    ))}
                    {loading && <div style={{ padding: '10px' }}>Загрузка...</div>}
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <h3>Правое окно (сортировка)</h3>
                <input
                    type="text"
                    placeholder="Фильтр по ID в правом окне"
                    value={rightFilter}
                    onChange={(e) => setRightFilter(e.target.value)}
                    style={{ marginBottom: '10px', width: '100%' }}
                />
                <div
                    style={{ height: '400px', overflowY: 'auto', border: '1px solid #ccc', marginTop: '10px', padding: '4px' }}
                    onScroll={handleRightScroll}
                >
                    {paginatedSelected.length === 0 && <div style={{ padding: '10px' }}>Нет выбранных</div>}
                    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={paginatedSelected.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            {paginatedSelected.map(item => (
                                <SortableItem key={item.id} item={item} onRemove={removeItem} />
                            ))}
                        </SortableContext>
                    </DndContext>
                    {rightLoading && <div style={{ padding: '10px' }}>Загрузка...</div>}
                </div>
            </div>
        </div>
    )
}

export default App
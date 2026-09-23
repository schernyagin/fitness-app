// Инициализация тестовых данных, если LocalStorage пустой
if (!localStorage.getItem('workouts')) {
    const sampleWorkouts = [
        { id: 1, title: 'Йога Утро', time: '2026-10-10T09:00', capacity: 10, clients: [] },
        { id: 2, title: 'Кроссфит Интенсив', time: '2026-10-10T19:00', capacity: 5, clients: ['Иван'] }
    ];
    localStorage.setItem('workouts', JSON.stringify(sampleWorkouts));
}

let currentUser = null;
let isCoach = false;

// Элементы экранов
const screens = {
    login: document.getElementById('screen-login'),
    client: document.getElementById('screen-client'),
    coach: document.getElementById('screen-coach')
};

// Функция переключения экранов
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    render();
}

// Авторизация
document.getElementById('btn-login-user').addEventListener('click', () => {
    const name = document.getElementById('username').value.trim();
    if (!name) return alert('Введите имя');
    currentUser = name;
    isCoach = false;
    document.getElementById('client-name').innerText = currentUser;
    switchScreen('client');
});

document.getElementById('btn-login-coach').addEventListener('click', () => {
    const pin = document.getElementById('username').value.trim();
    if (pin !== 'admin') return alert('Неверный пароль тренера (используйте admin)');
    currentUser = 'Тренер';
    isCoach = true;
    switchScreen('coach');
});

document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', () => {
        currentUser = null;
        isCoach = false;
        switchScreen('login');
    });
});

// Логика расписания
function getWorkouts() {
    return JSON.parse(localStorage.getItem('workouts')) || [];
}

function saveWorkouts(workouts) {
    localStorage.setItem('workouts', JSON.stringify(workouts));
    render();
}

// Рендеринг данных на экранах
function render() {
    const workouts = getWorkouts();

    if (screens.client.classList.contains('active')) {
        const container = document.getElementById('client-schedule');
        container.innerHTML = '';
        workouts.forEach(w => {
            const isSignedUp = w.clients.includes(currentUser);
            const spotsLeft = w.capacity - w.clients.length;
            
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <h4>${w.title}</h4>
                <p>📅 Время: ${new Date(w.time).toLocaleString()}</p>
                <p>👥 Мест осталось: ${spotsLeft} из ${w.capacity}</p>
                <button class="${isSignedUp ? 'btn-danger' : ''}" ${spotsLeft <= 0 && !isSignedUp ? 'disabled' : ''}>
                    ${isSignedUp ? 'Отменить запись' : (spotsLeft > 0 ? 'Записаться' : 'Мест нет')}
                </button>
            `;
            
            card.querySelector('button').addEventListener('click', () => {
                if (isSignedUp) {
                    w.clients = w.clients.filter(c => c !== currentUser);
                } else {
                    w.clients.push(currentUser);
                }
                saveWorkouts(workouts);
            });
            container.appendChild(card);
        });
    }

    if (screens.coach.classList.contains('active')) {
        const container = document.getElementById('coach-schedule');
        container.innerHTML = '';
        workouts.forEach(w => {
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <h4>${w.title}</h4>
                <p>📅 Время: ${new Date(w.time).toLocaleString()}</p>
                <p>👥 Записаны (${w.clients.length}/${w.capacity}): ${w.clients.join(', ') || 'никто'}</p>
                <button class="btn-danger">Удалить тренировку</button>
            `;
            card.querySelector('.btn-danger').addEventListener('click', () => {
                const filtered = workouts.filter(item => item.id !== w.id);
                saveWorkouts(filtered);
            });
            container.appendChild(card);
        });
    }
}

// Добавление тренировки тренером
document.getElementById('btn-add-workout').addEventListener('click', () => {
    const title = document.getElementById('new-title').value;
    const time = document.getElementById('new-time').value;
    const capacity = parseInt(document.getElementById('new-capacity').value);

    if (!title || !time || !capacity) return alert('Заполните все поля');

    const workouts = getWorkouts();
    workouts.push({
        id: Date.now(),
        title,
        time,
        capacity,
        clients: []
    });
    
    saveWorkouts(workouts);
    document.getElementById('new-title').value = '';
    document.getElementById('new-time').value = '';
    document.getElementById('new-capacity').value = '';
});

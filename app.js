// ВСТАВЬТЕ СЮДА ВАШ URL ВЕБ-ПРИЛОЖЕНИЯ ИЗ ШАГА 3
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlNbN80JmI0CWQ_kFxDrHlzvfBiAZk--JFx_yhZahGHuVFWcQo6iJJ-kSpm38dFzxO/exec";

let currentUser = null;
let isCoach = false;
let globalWorkouts = []; // Хранилище данных в памяти для быстрого рендеринга

const screens = {
    login: document.getElementById('screen-login'),
    client: document.getElementById('screen-client'),
    coach: document.getElementById('screen-coach')
};

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    loadAndRender(); // При каждом переключении экрана загружаем свежие данные
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

// Загрузка данных из Google Таблицы
async function loadAndRender() {
    // Показываем индикатор загрузки вместо пустого экрана (опционально)
    const clientCont = document.getElementById('client-schedule');
    const coachCont = document.getElementById('coach-schedule');
    if(screens.client.classList.contains('active')) clientCont.innerHTML = '<p>Загрузка расписания...</p>';
    if(screens.coach.classList.contains('active')) coachCont.innerHTML = '<p>Загрузка расписания...</p>';

    try {
        const response = await fetch(SCRIPT_URL);
        globalWorkouts = await response.json();
        render();
    } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        alert("Не удалось загрузить данные с сервера.");
    }
}

// Отправка команд на сервер (Google Sheets)
async function sendAction(payload) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Позволяет отправлять запросы без CORS-ошибок в Apps Script
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        // Из-за режима no-cors мы не можем прочитать ответ сервера, 
        // поэтому просто ждем секунду и обновляем интерфейс локально
        setTimeout(loadAndRender, 1500); 
    } catch (error) {
        console.error("Ошибка отправки данных:", error);
    }
}

// Отрисовка интерфейса
function render() {
    if (screens.client.classList.contains('active')) {
        const container = document.getElementById('client-schedule');
        container.innerHTML = globalWorkouts.length === 0 ? '<p>Тренировок пока нет.</p>' : '';
        
        globalWorkouts.forEach(w => {
            const isSignedUp = w.clients.includes(currentUser);
            const spotsLeft = w.capacity - w.clients.length;
            
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <h4>${w.title}</h4>
                <p>📅 Время: ${new Date(w.time).toLocaleString('ru-RU', {day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'})}</p>
                <p>👥 Мест осталось: ${spotsLeft > 0 ? spotsLeft : 0} из ${w.capacity}</p>
                <button class="${isSignedUp ? 'btn-danger' : ''}" ${spotsLeft <= 0 && !isSignedUp ? 'disabled' : ''}>
                    ${isSignedUp ? 'Отменить запись' : (spotsLeft > 0 ? 'Записаться' : 'Мест нет')}
                </button>
            `;
            
            card.querySelector('button').addEventListener('click', () => {
                // Оптимистичный UI: сразу меняем кнопку, чтобы пользователь видел отклик
                card.querySelector('button').innerText = "Обработка...";
                card.querySelector('button').disabled = true;
                
                sendAction({
                    action: "toggleSignUp",
                    id: w.id,
                    user: currentUser
                });
            });
            container.appendChild(card);
        });
    }

    if (screens.coach.classList.contains('active')) {
        const container = document.getElementById('coach-schedule');
        container.innerHTML = globalWorkouts.length === 0 ? '<p>Расписание пусто.</p>' : '';
        
        globalWorkouts.forEach(w => {
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <h4>${w.title}</h4>
                <p>📅 Время: ${new Date(w.time).toLocaleString('ru-RU', {day:'numeric', month:'long', hour:'2-digit', minute:'2-digit'})}</p>
                <p>👥 Записаны (${w.clients.length}/${w.capacity}): <b>${w.clients.join(', ') || 'никто'}</b></p>
                <button class="btn-danger">Удалить тренировку</button>
            `;
            card.querySelector('.btn-danger').addEventListener('click', () => {
                if(confirm(`Удалить тренировку "${w.title}"?`)) {
                    card.querySelector('.btn-danger').innerText = "Удаление...";
                    sendAction({ action: "delete", id: w.id });
                }
            });
            container.appendChild(card);
        });
    }
}

// Добавление тренировки тренером
document.getElementById('btn-add-workout').addEventListener('click', () => {
    const title = document.getElementById('new-title').value.trim();
    const time = document.getElementById('new-time').value;
    const capacity = parseInt(document.getElementById('new-capacity').value);

    if (!title || !time || !capacity) return alert('Заполните все поля');

    const newWorkout = {
        id: Date.now().toString(),
        title,
        time,
        capacity
    };

    document.getElementById('btn-add-workout').innerText = "Создание...";
    
    sendAction({
        action: "create",
        workout: newWorkout
    }).then(() => {
        document.getElementById('btn-add-workout').innerText = "Создать тренировку";
        document.getElementById('new-title').value = '';
        document.getElementById('new-time').value = '';
        document.getElementById('new-capacity').value = '';
    });
});

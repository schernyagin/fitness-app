// ВСТАВЬТЕ СЮДА ВАШ URL ВЕБ-ПРИЛОЖЕНИЯ ИЗ ШАГА 3
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlNbN80JmI0CWQ_kFxDrHlzvfBiAZk--JFx_yhZahGHuVFWcQo6iJJ-kSpm38dFzxO/exec";

let currentUser = null;
let isCoach = false;
let activeBookings = []; // Список всех занятых слотов из БД

const screens = {
    login: document.getElementById('screen-login'),
    client: document.getElementById('screen-client'),
    coach: document.getElementById('screen-coach')
};

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    loadAndRender(); 
}

// Перевод времени в минуты от начала дня ("08:30" -> 510)
function timeToMin(tStr) {
    const p = tStr.split(":");
    return parseInt(p[0]) * 60 + parseInt(p[1]);
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
    if (pin !== 'admin') return alert('Неверный пароль тренера');
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

// Загрузка данных
async function loadAndRender() {
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        // Фильтруем только реально занятые строки (где есть имя клиента)
        activeBookings = data.filter(b => b.client && b.client.trim() !== "");
        render();
    } catch (error) {
        console.error("Ошибка загрузки:", error);
    }
}

// Отправка запроса
async function sendAction(payload) {
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify(payload)
        });
        setTimeout(loadAndRender, 1200); 
    } catch (error) {
        console.error("Ошибка отправки:", error);
    }
}

// Отрисовка
function render() {
    // 1. ЛОГИКА ДЛЯ ПОДОПЕЧНОГО
    if (screens.client.classList.contains('active')) {
        const select = document.getElementById('client-time-select');
        const myBookingContainer = document.getElementById('client-my-booking');
        select.innerHTML = '';
        
        // Проверяем, записан ли уже этот пользователь куда-то
        const myCurrentBooking = activeBookings.find(b => b.client === currentUser);
        
        if (myCurrentBooking) {
            myBookingContainer.innerHTML = `
                <div class="workout-card" style="border-left: 5px solid #2196F3;">
                    <h4>Вы записаны на время: <b>${myCurrentBooking.time} - ${getEndTime(myCurrentBooking.time)}</b></h4>
                    <button class="btn-danger" id="btn-cancel-my">Отменить запись</button>
                </div>
            `;
            document.getElementById('btn-book-client').disabled = true;
            select.disabled = true;
            
            document.getElementById('btn-cancel-my').addEventListener('click', (e) => {
                e.target.innerText = "Отмена...";
                sendAction({ action: "cancel", time: myCurrentBooking.time });
            });
        } else {
            myBookingContainer.innerHTML = '<p>У вас пока нет активных записей на сегодня.</p>';
            document.getElementById('btn-book-client').disabled = false;
            select.disabled = false;
            
            // Генерируем доступные для выбора опции времени от 08:00 до 21:00
            for (let h = 8; h <= 21; h++) {
                const hourStr = h < 10 ? "0" + h : h;
                ["00", "30"].forEach(m => {
                    const timeOption = `${hourStr}:${m}`;
                    
                    // Проверяем, не пересекается ли эта опция (длиной 1 час) со всеми занятыми в БД
                    const isAvailable = checkTimeAvailable(timeOption);
                    
                    if (isAvailable) {
                        const opt = document.createElement('option');
                        opt.value = timeOption;
                        opt.innerText = `${timeOption} (до ${getEndTime(timeOption)})`;
                        select.appendChild(opt);
                    }
                });
            }
            if(select.options.length === 0) {
                select.innerHTML = '<option>Нет свободных окон на сегодня</option>';
                document.getElementById('btn-book-client').disabled = true;
            }
        }
    }

    // 2. ЛОГИКА ДЛЯ ТРЕНЕРА
    if (screens.coach.classList.contains('active')) {
        const container = document.getElementById('coach-schedule');
        container.innerHTML = activeBookings.length === 0 ? '<p>На сегодня записей нет. Все время свободно.</p>' : '';
        
        // Сортируем записи тренера по времени, чтобы они шли по порядку
        activeBookings.sort((a,b) => timeToMin(a.time) - timeToMin(b.time));
        
        activeBookings.forEach(b => {
            const card = document.createElement('div');
            card.className = 'workout-card';
            card.innerHTML = `
                <h4>⏰ Время: ${b.time} - ${getEndTime(b.time)}</h4>
                <p>Подопечный: <b style="color:#2196F3;">${b.client}</b></p>
                <button class="btn-danger">Отменить тренировку и освободить время</button>
            `;
            card.querySelector('button').addEventListener('click', (e) => {
                if (confirm(`Удалить запись клиента ${b.client} на ${b.time}?`)) {
                    e.target.innerText = "Освобождение...";
                    sendAction({ action: "cancel", time: b.time });
                }
            });
            container.appendChild(card);
        });
    }
}

// Функция проверки: свободно ли время начала и часовой интервал после него
function checkTimeAvailable(timeStr) {
    const start = timeToMin(timeStr);
    const end = start + 60;
    
    for (let b of activeBookings) {
        const bStart = timeToMin(b.time);
        const bEnd = bStart + 60;
        
        // Если интервалы накладываются, то это время недоступно
        if (Math.max(start, bStart) < Math.min(end, bEnd)) {
            return false;
        }
    }
    return true;
}

// Функция вычисления времени окончания (+1 час)
function getEndTime(timeStr) {
    const parts = timeStr.split(":");
    let h = parseInt(parts[0]) + 1;
    return (h < 10 ? "0" + h : h) + ":" + parts[1];
}

// НАДЕЖНЫЙ ОБРАБОТЧИК: Кнопка отвиснет в любом случае
document.getElementById('btn-book-client').addEventListener('click', async (e) => {
    const select = document.getElementById('client-time-select');
    const selectedTime = select.value;
    if(!selectedTime || selectedTime.includes("Нет")) return;
    
    // Визуально блокируем кнопку, чтобы избежать повторных кликов
    e.target.innerText = "Бронирование...";
    e.target.disabled = true;
    
    // Запускаем отправку данных в таблицу
    await sendAction({
        action: "book",
        time: selectedTime,
        user: currentUser
    });

    // ПРИНУДИТЕЛЬНЫЙ СБРОС КНОПКИ: 
    // Если через 2.5 секунды страница не обновилась сама, возвращаем кнопку в рабочий режим
    setTimeout(() => {
        if (e.target) {
            e.target.innerText = "Забронировать это время";
            e.target.disabled = false;
        }
    }, 2500);
});



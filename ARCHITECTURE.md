# Warframe Nexus — Концепция и Техническая Архитектура

> Универсальное десктопное приложение-помощник для заработка платины, аналитики рынка и автоматизации рутины в Warframe.

---

## 1. Концепция

**Проблема**: Существует множество разрозненных Open Source инструментов для Warframe (CLI-утилиты, браузерные расширения, скрипты автоматизации), каждый решает узкую задачу. Ни один не объединяет анализ рынка, торговлю, фарм, реликвии, инвентарь и автоматизацию в едином интерфейсе.

**Решение**: Единое десктопное приложение с модульной архитектурой, объединяющее лучшие практики существующих проектов:

| Проект | Что берём |
|---|---|
| Warframe-Algo-Trader | Алгоритмическая торговля, управление инвентарём, интеграция с warframe.market |
| Warframe-Tools | Price oracle, bulk search, expected plat per relic |
| WFMTacker (ext) | Price history charts, buy/sell signals, watchlist |
| warframe-market-predictor | Фоновая аналитика трендов, push-уведомления |
| WarframeHelper | DPP (ducats per platinum) расчёты для Baro Ki'teer |
| wfinfo-ng | OCR-анализ экрана реликвий |
| Warframe-Market-deal-finder | Поиск конверсии в дукаты/эндо, анализ ривенов |
| glyph-redeemer | Автоматический ввод кодов |
| warframe-ahk | Автоматизация рутинных действий (Eidolon, фарм) |

**Новый функционал** (сверх существующего):
- Фарм-планировщик с оптимизацией маршрутов
- Предиктивная аналитика с ML (Prophet/ARIMA)
- Оптимизатор открытия реликвий
- Интеграция с AlecaFrame для полного учёта инвентаря
- Оценка стоимости коллекции и P&L портфеля
- Оверлей для игры (read-only, без нарушения ToS)

---

## 2. Технический стек

```
┌─────────────────────────────────────────────────────┐
│                   Desktop UI (Tauri)                 │
│              React + TypeScript + Tailwind           │
│          Chart.js / D3.js / React Flow               │
├─────────────────────────────────────────────────────┤
│              HTTP (REST + WebSocket)                 │
├─────────────────────────────────────────────────────┤
│              Backend (Python 3.11+)                   │
│     FastAPI + SQLAlchemy + Celery + APScheduler      │
│     NumPy / Pandas / scikit-learn / Prophet          │
│     httpx / OpenCV / pytesseract / Pillow            │
├─────────────────────────────────────────────────────┤
│              Local Storage                           │
│     PostgreSQL (или SQLite) + Redis + S3/MinIO       │
└─────────────────────────────────────────────────────┘
```

### Why Python + Tauri (не Electron)?

| Критерий | Tauri + React | Electron |
|---|---|---|
| Размер установки | ~5 MB | ~150+ MB |
| Потребление RAM | ~50-100 MB | ~200-500 MB |
| Нативный доступ | Rust (system tray, notifications, FS) | Node.js |
| Интеграция с Python | Запуск sidecar процесса | Возможен, но тяжелее |
| Доступ к API ОС | Полный через Rust backend | Через Node.js |

Python выбран как язык аналитики — существующие проекты (Warframe-Tools, warframe-market-predictor, Warframe-Market-deal-finder) уже написаны на Python, библиотеки для ML/статистики зрелые.

---

## 3. Модульная архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI / Tauri UI                        │
├─────────────────────────────────────────────────────────────┤
│                     FastAPI Backend                         │
├───────────────────┬──────────────────┬──────────────────────┤
│                   │                  │                      │
│    Market Module  │  Relic Module    │  Trading Module      │
│                   │                  │                      │
│  • WF API client  │  • Expected plat │  • Auto-posting     │
│  • Price oracle   │  • OCR analysis  │  • Order management  │
│  • History DB     │  • Optimizer     │  • Best trader find  │
│  • Watchlist      │  • Screen cap    │  • Trade history     │
│                   │                  │                      │
├───────────────────┼──────────────────┼──────────────────────┤
│                   │                  │                      │
│  Analysis Module  │ Inventory Module │  Farming Module      │
│                   │                  │                      │
│  • Trend detect   │  • AlecaFrame    │  • Drop table parser │
│  • Price predict  │  • Manual mgmt   │  • Route optimizer   │
│  • Signal gen     │  • Duplicate det │  • Efficiency calc   │
│  • DPP calculator │  • Portfolio val │  • Resource planner  │
│                   │                  │                      │
├───────────────────┴──────────────────┴──────────────────────┤
│                                                             │
│                   Automation Module                         │
│                                                             │
│  • Glyph redeemer  • EE.log watcher  • AHK integration      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   Notifications Module                      │
│                                                             │
│   Desktop toast  │  Push (ntfy)  │  Discord  │  Email      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Market Module

**Назначение**: Единый интерфейс к warframe.market API.

```
Market Module
├── WFMApiClient (async httpx, rate-limited)
│   ├── get_items()
│   ├── get_orders(item)
│   ├── get_statistics(item, hours)
│   ├── get_historical(item, days)
│   └── (authenticated) post_order / delete_order
├── PriceOracle
│   ├── OracleMedian — медиана за N часов
│   ├── OracleMean — среднее за N часов
│   ├── OracleVolumeWeighted — взвешенное по объёму
│   ├── OracleTimeDecay — с дисконтом старых цен
│   └── OracleDynamic — переключение стратегии по волатильности
├── PriceHistoryCollector
│   └── Background task: сбор статистики каждые 15 мин → DB
└── WatchlistManager
    └── Пользовательский список отслеживания с порогами
```

**Заимствования**: `Warframe-Tools` (PriceOracle, bulk search), `WFMTacker` (watchlist + alerts logic), `Huntk23/WarframeMarketTracker` (polling + notifications).

### 3.2 Analysis Module

**Назначение**: Статистика, тренды, сигналы и предиктивная аналитика.

```
Analysis Module
├── TrendAnalyzer
│   ├── slope() — линейная регрессия цены
│   ├── momentum() — скорость изменения
│   ├── volatility() — CoV, std dev
│   └── seasonality() — внутридневные/недельные паттерны
├── SignalGenerator
│   ├── BUY signal: спад + восходящий тренд + объём
│   ├── SELL signal: пик + нисходящий тренд
│   ├── HOLD signal: низкий объём, временный спад
│   └── confidence_score()
├── PredictiveModel
│   ├── Prophet (Facebook) — для сезонных рядов
│   ├── ARIMA — для коротких прогнозов
│   └── LinearRegression — быстрый baseline
├── BaroDPPCalculator
│   └── ducats_per_platinum = ducat_value / buy_price
└── DucatEndoOptimizer
    └── Какие предметы выгоднее: продать за платину / обменять на дукаты
```

**Заимствования**: `francis-p-n/warframe-market-predictor` (5-metric trend analysis, signal generation), `SamuilDichev/WarframeHelper` (DPP), `Luis-Munu/Warframe-Market-deal-finder` (ducat/endo optimization).

**Новое**: ML-модели для прогнозирования с учётом событий (Baro приход, обновления, выход новых праймов).

### 3.3 Relic Module

**Назначение**: Оптимизация выбора и открытия реликвий.

```
Relic Module
├── RelicExpectedPlatCalculator
│   └── Σ(rarity_probability × item_plat_price) по каждому дропу
├── RelicOptimizer
│   └── Для набора реликвий: какая даёт макс. ожидаемую платину
├── RelicScreenAnalyzer
│   ├── ScreenshotCapture (win32 API / X11)
│   ├── OCRProcessor (pytesseract)
│   └── ItemMatcher → платиновая стоимость каждого предмета
└── RelicInventoryManager
    └── Какие реликвии есть, сколько, какой expected value
```

**Заимствования**: `knoellle/wfinfo-ng` (OCR + EE.log триггер), `Kaiserouo/Warframe-Tools` (relic expected plat calculation).

### 3.4 Inventory Module

**Назначение**: Полный учёт игрового инвентаря.

```
Inventory Module
├── AlecaFrameCacheReader
│   └── Парсинг SQLite кэша AlecaFrame (инвентарь, моды, реликвии)
├── ManualInventoryManager
│   ├── Добавление/удаление предметов вручную
│   └── Категоризация (Prime parts, mods, rivens, resources)
├── DuplicateDetector
│   └── Что >1 шт. → можно продать
├── PortfolioValuator
│   ├── total_value = Σ(quantity × current_market_price)
│   ├── cost_basis = средняя цена покупки
│   └── unrealized_pnl = total_value - cost_basis
└── SyncEngine
    └── Синхронизация с Trading Module для автоматических постов
```

**Заимствования**: `akmayer/Warframe-Algo-Trader` (inventory API, transaction tracking), идеи из `Sentinel-for-Warframe` (AlecaFrame кэш).

### 3.5 Trading Module

**Назначение**: Алгоритмическая торговля на warframe.market.

```
Trading Module
├── AutoPostingEngine
│   ├── Анализ текущих ордеров и спреда
│   ├── Расчёт оптимальной цены (чуть выше лучшего бай/селл)
│   └── batch_post / batch_cancel через JWT
├── OrderManager
│   ├── sync_orders() — привести ордера в соответствие с инвентарём
│   ├── cancel_expired() — снять устаревшие
│   └── update_prices() — подстройка под рынок
├── BestTraderFinder
│   └── Поиск игроков с минимальным отклонением от oracle price
├── TradeLogger
│   └── Каждая сделка: предмет, цена, дата, контрагент → P&L
└── ProfitVisualizer
    └── График P&L, NAV портфеля, доходность по дням/неделям
```

**Заимствования**: `akmayer/Warframe-Algo-Trader` (полный цикл торговли — LiveScraper, AutoScan, inventory API).

### 3.6 Farming Module

**Назначение**: Планирование эффективного фарма.

```
Farming Module
├── DropTableParser
│   ├── Fetch с официального API DE
│   └── Fallback: парсинг вики Warframe
├── RouteOptimizer
│   └── Для списка целей → какие миссии, в каком порядке
├── ResourceFarmingPlanner
│   └── "Хочу N нейронных датчиков" → лучшие миссии / локации
└── EfficiencyCalculator
    └── expected_platinum_per_hour по каждому маршруту
```

**Новое**: Полностью новый модуль, не реализованный ни в одном из существующих проектов.

### 3.7 Automation Module

**Назначение**: Автоматизация рутинных операций.

```
Automation Module
├── GlyphRedeemer
│   └── Puppeteer/Playwright → warframe.com → ввод всех кодов
├── EELogWatcher
│   ├── Мониторинг EE.log через inotify/FileSystemWatcher
│   ├── Детекция входящего шёпота (whisper)
│   ├── Детекция экрана награды (reward screen)
│   └── Callback → Trading Module / Relic Module
├── AHKScriptManager
│   ├── Запуск/остановка AHK-скриптов
│   ├── Список скриптов (Eidolon, фарм, спам)
│   └── Интеграция с LazyHub
└── MacroRecorder
    └── Запись и воспроизведение последовательностей клавиш
```

**Заимствования**: `Noxde/glyph-redeemer` (Puppeteer), `akmayer/Warframe-Algo-Trader` (EE.log watcher), `Lazy-World/warframe-ahk` (AHK library).

### 3.8 Notifications Module

**Назначение**: Оповещения о событиях.

```
Notifications Module
├── DesktopNotifier (Tauri native notifications)
├── PushNotifier (ntfy.sh — бесплатно, без регистрации)
├── DiscordWebhookNotifier
├── EmailNotifier (SMTP)
└── EventRouter
    └── Подписка на события из всех модулей →
        └── "Цель достигнута", "Найден бай", "Сигнал BUY", ...
```

**Заимствования**: `francis-p-n/warframe-market-predictor` (ntfy.sh), `akmayer/Warframe-Algo-Trader` (Pushbullet + Discord).

---

## 4. Data Model

### 4.1 Core Entities

```
┌──────────────┐     ┌────────────────┐     ┌──────────────────┐
│    Item      │────→│  PricePoint    │     │    UserOrder     │
├──────────────┤     ├────────────────┤     ├──────────────────┤
│ id (str)     │     │ id             │     │ id               │
│ name (str)   │     │ item_id (FK)   │     │ item_id (FK)     │
│ slug (str)   │     │ price (float)  │     │ order_type (enum)│
│ category     │     │ volume (int)   │     │ platinum (int)   │
│ subcategory  │     │ timestamp (dt) │     │ quantity (int)   │
│ ducats (int) │     │ source (str)   │     │ status (enum)    │
│ mod_rank     │     └────────────────┘     │ created_at (dt)  │
│ set (bool)   │                            └──────────────────┘
└──────────────┘
                       ┌──────────────────┐
                       │   Transaction    │
                       ├──────────────────┤
                       │ id               │
                       │ item_id (FK)     │
                       │ type (buy/sell)  │
                       │ price (float)    │
                       │ quantity (int)   │
                       │ counterparty     │
                       │ timestamp (dt)   │
                       │ platform (enum)  │
                       └──────────────────┘
```

### 4.2 Relic Model

```
┌──────────────┐     ┌──────────────────┐
│    Relic     │────→│   RelicDrop     │
├──────────────┤     ├──────────────────┤
│ id (str)     │     │ id              │
│ name (str)   │     │ relic_id (FK)   │
│ era (enum)   │     │ item_id (FK)    │
│ tier (int)   │     │ rarity (enum)   │
│ vaulted (bool)     │ chance (float)  │
└──────────────┘     └──────────────────┘
```

### 4.3 Inventory Model

```
┌──────────────────┐
│  InventoryItem   │
├──────────────────┤
│ id               │
│ user_id          │
│ item_id (FK)     │
│ quantity (int)   │
│ avg_buy_price    │
│ source (enum)    │
│   [manual,       │
│    alecaframe,   │
│    auto]         │
│ updated_at (dt)  │
└──────────────────┘
```

---

## 5. API Design (FastAPI)

```
/api/v1
├── /market
│   ├── GET  /items              — каталог предметов
│   ├── GET  /items/{slug}       — информация о предмете
│   ├── GET  /items/{slug}/orders — ордера
│   ├── GET  /items/{slug}/stats  — статистика цен
│   ├── GET  /search?q=          — поиск
│   ├── GET  /watchlist          — список отслеживания
│   ├── POST /watchlist          — добавить в отслеживание
│   ├── DELETE /watchlist/{id}   — удалить из отслеживания
│   └── WS   /live               — real-time обновления цен
│
├── /analysis
│   ├── GET  /signals            — текущие сигналы
│   ├── GET  /predict/{slug}     — прогноз цены
│   ├── GET  /baro               — DPP для Baro
│   ├── GET  /top-deals          — лучшие сделки сейчас
│   └── GET  /report/daily       — ежедневный отчёт
│
├── /relics
│   ├── GET  /relics             — каталог реликвий
│   ├── GET  /relics/{id}/expected — expected plat
│   ├── POST /scan               — анализ скриншота
│   └── POST /optimize           — оптимизатор выбора
│
├── /inventory
│   ├── GET  /items              — инвентарь
│   ├── POST /items              — добавить предмет
│   ├── PUT  /items/{id}         — обновить количество
│   ├── DELETE /items/{id}       — удалить
│   ├── GET  /duplicates         — дубликаты
│   ├── GET  /valuation          — стоимость коллекции
│   ├── GET  /pnl                — прибыль/убыток
│   └── POST /sync/alecaframe    — синхронизация с AlecaFrame
│
├── /trading
│   ├── POST /auto-post          — запустить авто-постинг
│   ├── POST /stop               — остановить
│   ├── GET  /orders             — текущие ордера
│   ├── DELETE /orders/{id}      — снять ордер
│   └── GET  /history            — история сделок
│
├── /farming
│   ├── GET  /drops/{item}       — дроп-таблицы
│   ├── POST /plan               — построить маршрут
│   └── GET  /efficiency         — эффективность фарма
│
├── /automation
│   ├── POST /glyphs/start       — запустить редим кодов
│   ├── GET  /ahk/scripts        — список AHK скриптов
│   ├── POST /ahk/start/{id}     — запустить скрипт
│   └── POST /ahk/stop/{id}      — остановить
│
└── /notifications
    ├── GET  /settings           — настройки уведомлений
    └── PUT  /settings           — обновить настройки
```

---

## 6. Data Flow Diagram

```
                    ┌──────────────────┐
                    │  Warframe Market  │
                    │      API         │
                    └────────┬─────────┘
                             │ HTTPS (async, rate-limited)
                             ▼
                    ┌──────────────────┐
                    │  Market Module   │
                    │  (Data Collector) │
                    └────────┬─────────┘
                             │ Write
                             ▼
                    ┌──────────────────┐
                    │    SQLite/DB     │◄────┐
                    │  price_history   │     │
                    │  items catalog   │     │
                    │  relic_info      │     │
                    │  transactions    │     │
                    │  user_settings   │     │
                    └────────┬─────────┘     │
                             │                │
              ┌──────────────┼──────────────┐ │
              ▼              ▼              ▼ │
     ┌─────────────┐ ┌──────────────┐ ┌──────────┐ │
     │  Analysis   │ │  Relic       │ │ Farming  │ │
     │  Module     │ │  Module      │ │ Module   │ │
     └──────┬──────┘ └──────┬───────┘ └────┬─────┘ │
            │               │              │        │
            └───────┬───────┘              │        │
                    │ Read                 │        │
                    ▼                      │        │
            ┌───────────────┐              │        │
            │  FastAPI REST + WS           │        │
            └───────┬───────┘              │        │
                    │                      │        │
                    ▼                      │        │
            ┌───────────────┐              │        │
            │  Tauri UI     │              │        │
            │  (React/TS)   │              │        │
            └───────┬───────┘              │        │
                    │ User actions          │        │
                    ▼                      │        │
            ┌───────────────┐              │        │
            │  Trading      │──────────────┘        │
            │  Module       │─────── Write ─────────┘
            │  (Auto-post)  │
            └───────┬───────┘
                    │ HTTPS + JWT
                    ▼
            ┌──────────────────┐
            │  Warframe Market  │
            │  API (authenticated)
            └──────────────────┘

    External inputs:
    ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
    │  AlecaFrame  │     │  EE.log          │     │  Screenshots     │
    │  SQLite cache│     │  (File watcher)   │     │  (OCR)           │
    └──────┬───────┘     └────────┬─────────┘     └────────┬─────────┘
           ▼                      ▼                       ▼
    ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
    │  Inventory   │     │  Automation      │     │  Relic Module    │
    │  Module      │     │  Module          │     │  (Screen analysis)
    └──────────────┘     └──────────────────┘     └──────────────────┘
```

---

## 7. Структура репозитория

```
warframe-nexus/
├── backend/
│   ├── app/
│   │   ├── core/           — config, logging, db session, event bus
│   │   ├── market/          — market module
│   │   ├── analysis/        — analysis module
│   │   ├── relics/          — relic module
│   │   ├── inventory/       — inventory module
│   │   ├── trading/         — trading module
│   │   ├── farming/         — farming module
│   │   ├── automation/      — automation module
│   │   ├── notifications/   — notifications module
│   │   ├── api/             — route definitions
│   │   └── schemas/         — Pydantic models
│   ├── data/                — SQLite DB, AlecaFrame cache mirror
│   ├── scripts/             — батники для запуска
│   ├── alembic/             — миграции
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── stores/          — Zustand stores
│   │   └── lib/             — API client (RTK Query / tRPC)
│   ├── src-tauri/           — Rust backend Tauri
│   └── package.json
├── docs/
├── docker-compose.yml
├── Makefile
└── README.md
```

---

## 8. Безопасность

1. **JWT токены** warframe.market хранятся в системном keyring (не в файлах)
2. **Переменные окружения** для API ключей (ntfy, Pushbullet, Discord)
3. **Локальная БД** — на машине пользователя, без отправки на сервер
4. **AlecaFrame кэш** — только чтение, без модификации
5. **Скриншоты** — обрабатываются локально, не отправляются вовне
6. **AHK/Glyph** — пользователь явно запускает автоматизацию
7. **Rate limiting** — соблюдение лимитов warframe.market (2 req/s)

---

## 9. План реализации (фазы)

### Фаза 1: MVP (2-3 месяца)
- Backend: FastAPI + Market Module + PriceOracle + ценая статистика
- UI: Tauri + React (список предметов, графики цен, поиск)
- Watchlist с уведомлениями
- Основные API эндпоинты

### Фаза 2: Аналитика + Торговля (3-4 месяца)
- Analysis Module (сигналы, тренды, DPP)
- Inventory Module (ручное добавление, ручная синхронизация)
- Trading Module (auto-posting, управление ордерами)
- Relic Module (expected plat, базовый оптимизатор)

### Фаза 3: ML + Продвинутые функции (2-3 месяца)
- PredictiveModel (Prophet, ARIMA)
- Relic OCR (wfinfo-ng совместимость)
- Farming Module (дроп-таблицы, маршруты)
- AlecaFrame интеграция

### Фаза 4: Автоматизация + Оверлей (2-3 месяца)
- Automation Module (EE.log, glyph, AHK)
- Portfolio tracking + P&L
- In-game overlay (режим read-only)
- Riven analysis

---

## 10. Лицензия и распространение

- **Лицензия**: MIT (максимальная совместимость с существующими проектами, многие из которых MIT)
- **Распространение**:
  - GitHub Releases (Windows .msi / .exe, Linux .AppImage / .deb, macOS .dmg)
  - Возможна публикация в Chocolatey / Scoop / Homebrew
  - Docker образ для headless-режима (серверная версия)

---

## 11. Сравнение с существующими проектами

| Функция | Algo-Trader | WF-Tools | WFM-Predictor | WFMTracker | WFM-Tacker | Warframe Nexus |
|---|---|---|---|---|---|---|
| Price oracle | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (все стратегии) |
| Auto-posting | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Signals | ✅ (basic) | ❌ | ✅ | ❌ | ✅ | ✅ (ML-enhanced) |
| Price chart | ✅ | ❌ | ❌ | ❌ | ✅ (ext) | ✅ (native) |
| Relic analysis | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ + OCR |
| Inventory mgmt | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ + AlecaFrame |
| Desktop app | Web UI | CLI | CLI | ✅ (C#) | Extension | ✅ (Tauri) |
| Notifications | Push + Discord | ❌ | ntfy | Desktop | Desktop | Все каналы |
| EE.log watcher | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Riven analysis | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Farming planner | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| ML prediction | ❌ | ❌ | Linear reg | ❌ | Linear reg | ✅ (Prophet + ARIMA) |
| Cross-platform | ✅ | ✅ | ✅ | Win/Linux | ✅ | ✅ |

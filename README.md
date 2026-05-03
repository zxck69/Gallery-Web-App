# 🐾 WOOF — Advanced Dog Gallery Web App

A full-stack dog breed gallery built with **FastAPI** (Python) and vanilla JS. Features persistent likes, recently viewed history, infinite scroll, sharing, zoom, dark mode, and more.

---

## ✨ Features

| Feature                 | Details                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| **Breed Listing**       | Responsive grid of all Dog CEO API breeds with lazy-loaded thumbnails                       |
| **Search**              | Real-time search bar to filter by breed name                                                |
| **Pagination**          | Load-more pagination for breed grid (20 per page)                                           |
| **Breed Detail Modal**  | Gallery view with 10 images loaded initially, load more, direct URL access (`/breed/hound`) |
| **Like System**         | Persistent likes via FastAPI + SQLite, POST/DELETE/GET APIs                                 |
| **Share**               | Web Share API with clipboard fallback; shareable URLs include breed + image index           |
| **Recently Viewed**     | Last 5 breeds tracked in DB, shown on home page as horizontal chips                         |
| **Filters**             | All / Liked Breeds / Recently Viewed                                                        |
| **Sort**                | A→Z, Z→A, Most Liked (from backend aggregation)                                             |
| **Error Handling**      | Skeletons, error banners with retry buttons, empty state handling                           |
| **Dark Mode**           | Toggle with localStorage persistence                                                        |
| **Image Zoom**          | Click any image to zoom fullscreen with like/share actions                                  |
| **Background Prefetch** | FastAPI BackgroundTasks prefetch breed images on first view                                 |
| **Responsive**          | Mobile, tablet, desktop fully supported                                                     |
| **Toast Notifications** | Feedback for like/share/copy actions                                                        |

---

## 🚀 Setup

### Prerequisites

- Python 3.10+
- pip

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/dog-gallery.git
cd dog-gallery

# Install backend dependencies
pip install -r backend/requirements.txt

# Run the server
cd backend
uvicorn main:app --reload --port 8000
```

Open your browser at: **http://localhost:8000**

---

## 📁 Project Structure

```
dog-gallery/
├── backend/
│   ├── main.py           # FastAPI application
│   ├── requirements.txt
│   ├── test_main.py      # Unit tests
│   └── dog_gallery.db    # SQLite DB (auto-created)
└── frontend/
    ├── index.html        # Single-page app entry
    └── static/
        ├── css/styles.css
        └── js/app.js
```

---

## 📡 API Documentation

Base URL: `http://localhost:8000`

### Like Endpoints

#### `POST /like`

Like an image.

**Request Body:**

```json
{ "image_url": "https://...", "breed": "husky" }
```

**Response:** `{ "status": "liked", "image_url": "..." }`  
**409** if already liked.

---

#### `DELETE /like?image_url=<url>`

Unlike an image.

**Response:** `{ "status": "unliked", "image_url": "..." }`  
**404** if not found.

---

#### `GET /likes`

Get all liked images.

**Response:**

```json
[{ "image_url": "...", "breed": "husky", "created_at": "..." }]
```

---

#### `GET /likes/breeds`

Breeds sorted by number of likes (used for "Most Liked" sort).

**Response:**

```json
[{ "breed": "husky", "count": 5 }]
```

---

### Viewed Endpoints

#### `POST /viewed`

Record a breed view.

**Request Body:** `{ "breed": "labrador" }`  
**Response:** `{ "status": "recorded", "breed": "labrador" }`

---

#### `GET /viewed`

Get last 5 viewed breeds (most recent first).

**Response:**

```json
[{ "breed": "labrador", "last_viewed": "...", "view_count": 3 }]
```

---

### Utility

#### `GET /prefetch/{breed}`

Trigger background image prefetch for a breed.

#### `GET /stats`

App-wide statistics.

---

## 🧪 Running Tests

```bash
cd backend
pip install pytest httpx
pytest test_main.py -v
```

Tests cover:

- Like / unlike / duplicate / 404 cases
- Viewed upsert and 5-item limit
- Stats aggregation
- Prefetch background task

---

## 🌐 Deployment

### Render / Railway / Fly.io

1. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
2. Set working directory to `backend/`
3. Add `requirements.txt` build step
4. Use a persistent disk for the SQLite DB, or swap to PostgreSQL via `asyncpg`

### PostgreSQL (production upgrade)

Replace the `sqlite3` calls in `main.py` with `databases` + `asyncpg`. The SQL schema is standard and fully portable.

---

## 🛠 Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Backend      | FastAPI, SQLite, httpx                  |
| Frontend     | Vanilla JS, CSS Variables, Google Fonts |
| External API | [Dog CEO API](https://dog.ceo/dog-api/) |
| Testing      | pytest, httpx                           |

---

## 📸 Screenshots

_(Add your screenshots here after deployment)_

---

## 📜 License

MIT

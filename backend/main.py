from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import httpx
import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime

DB_PATH = "dog_gallery.db"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_url TEXT UNIQUE NOT NULL,
            breed TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS viewed_breeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            breed TEXT UNIQUE NOT NULL,
            last_viewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            view_count INTEGER DEFAULT 1
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS breed_cache (
            breed TEXT PRIMARY KEY,
            images TEXT,
            cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Dog Gallery API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ─────────────────────────────────────────────────────────
class LikeRequest(BaseModel):
    image_url: str
    breed: str


class ViewedRequest(BaseModel):
    breed: str


# ── Like Endpoints ──────────────────────────────────────────────────
@app.post("/like")
def like_image(req: LikeRequest):
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO likes (image_url, breed) VALUES (?, ?)",
            (req.image_url, req.breed)
        )
        conn.commit()
        return {"status": "liked", "image_url": req.image_url}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Already liked")
    finally:
        conn.close()


@app.delete("/like")
def unlike_image(image_url: str):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("DELETE FROM likes WHERE image_url = ?", (image_url,))
    conn.commit()
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Like not found")
    return {"status": "unliked", "image_url": image_url}


@app.get("/likes")
def get_likes():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT image_url, breed, created_at FROM likes ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [{"image_url": r[0], "breed": r[1], "created_at": r[2]} for r in rows]


@app.get("/likes/breeds")
def get_liked_breeds():
    """Return breeds sorted by number of liked images (for sort feature)."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT breed, COUNT(*) as cnt FROM likes GROUP BY breed ORDER BY cnt DESC"
    ).fetchall()
    conn.close()
    return [{"breed": r[0], "count": r[1]} for r in rows]


# ── Viewed Endpoints ────────────────────────────────────────────────
@app.post("/viewed")
def add_viewed(req: ViewedRequest):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO viewed_breeds (breed, last_viewed, view_count)
        VALUES (?, CURRENT_TIMESTAMP, 1)
        ON CONFLICT(breed) DO UPDATE SET
            last_viewed = CURRENT_TIMESTAMP,
            view_count = view_count + 1
    """, (req.breed,))
    conn.commit()
    conn.close()
    return {"status": "recorded", "breed": req.breed}


@app.get("/viewed")
def get_viewed():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT breed, last_viewed, view_count FROM viewed_breeds ORDER BY last_viewed DESC, id DESC LIMIT 5"
    ).fetchall()
    conn.close()
    return [{"breed": r[0], "last_viewed": r[1], "view_count": r[2]} for r in rows]


# ── Background prefetch ─────────────────────────────────────────────
async def prefetch_breed_images(breed: str):
    """Background task to cache breed images."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = f"https://dog.ceo/api/breed/{breed.replace(' ', '/')}/images"
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                import json
                conn = sqlite3.connect(DB_PATH)
                conn.execute(
                    "INSERT OR REPLACE INTO breed_cache (breed, images, cached_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                    (breed, json.dumps(data.get("message", [])))
                )
                conn.commit()
                conn.close()
    except Exception:
        pass


@app.get("/prefetch/{breed}")
async def trigger_prefetch(breed: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(prefetch_breed_images, breed)
    return {"status": "prefetching", "breed": breed}


# ── Stats ──────────────────────────────────────────────────────────
@app.get("/stats")
def get_stats():
    conn = sqlite3.connect(DB_PATH)
    total_likes = conn.execute("SELECT COUNT(*) FROM likes").fetchone()[0]
    total_viewed = conn.execute("SELECT COUNT(*) FROM viewed_breeds").fetchone()[0]
    top_breed = conn.execute(
        "SELECT breed, COUNT(*) as cnt FROM likes GROUP BY breed ORDER BY cnt DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return {
        "total_likes": total_likes,
        "total_viewed_breeds": total_viewed,
        "top_liked_breed": top_breed[0] if top_breed else None,
    }


# ── Serve Frontend ─────────────────────────────────────────────────
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(os.path.join(frontend_path, "static")):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    index = os.path.join(frontend_path, "index.html")
    if os.path.exists(index):
        return FileResponse(index)
    return {"message": "Dog Gallery API running. Frontend not found."}

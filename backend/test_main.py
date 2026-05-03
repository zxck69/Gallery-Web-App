"""
Unit tests for the Dog Gallery FastAPI backend.
Run: pytest test_main.py -v
"""
import os
import pytest
import tempfile
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(__file__))

# Point to a temp file BEFORE importing main
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
TEST_DB = _tmp.name

import main
main.DB_PATH = TEST_DB
main.init_db()

from main import app, init_db
from fastapi.testclient import TestClient

client = TestClient(app)


# ─── Helper ────────────────────────────────────────
def reset_db():
    conn = sqlite3.connect(TEST_DB)
    conn.execute("DELETE FROM likes")
    conn.execute("DELETE FROM viewed_breeds")
    conn.commit()
    conn.close()


# ─── Like Endpoints ─────────────────────────────────
class TestLikes:
    def setup_method(self):
        reset_db()

    def test_like_image(self):
        r = client.post("/like", json={"image_url": "http://test.com/dog1.jpg", "breed": "husky"})
        assert r.status_code == 200
        assert r.json()["status"] == "liked"

    def test_like_duplicate_returns_409(self):
        client.post("/like", json={"image_url": "http://test.com/dog2.jpg", "breed": "husky"})
        r = client.post("/like", json={"image_url": "http://test.com/dog2.jpg", "breed": "husky"})
        assert r.status_code == 409

    def test_unlike_image(self):
        client.post("/like", json={"image_url": "http://test.com/dog3.jpg", "breed": "lab"})
        r = client.delete("/like", params={"image_url": "http://test.com/dog3.jpg"})
        assert r.status_code == 200
        assert r.json()["status"] == "unliked"

    def test_unlike_nonexistent_returns_404(self):
        r = client.delete("/like", params={"image_url": "http://nope.com/none.jpg"})
        assert r.status_code == 404

    def test_get_likes_empty(self):
        r = client.get("/likes")
        assert r.status_code == 200
        assert r.json() == []

    def test_get_likes_returns_list(self):
        client.post("/like", json={"image_url": "http://test.com/dog4.jpg", "breed": "poodle"})
        r = client.get("/likes")
        data = r.json()
        assert len(data) == 1
        assert data[0]["breed"] == "poodle"

    def test_liked_breeds_aggregation(self):
        client.post("/like", json={"image_url": "http://test.com/a.jpg", "breed": "beagle"})
        client.post("/like", json={"image_url": "http://test.com/b.jpg", "breed": "beagle"})
        client.post("/like", json={"image_url": "http://test.com/c.jpg", "breed": "corgi"})
        r = client.get("/likes/breeds")
        data = r.json()
        assert data[0]["breed"] == "beagle"
        assert data[0]["count"] == 2


# ─── Viewed Endpoints ───────────────────────────────
class TestViewed:
    def setup_method(self):
        reset_db()

    def test_add_viewed(self):
        r = client.post("/viewed", json={"breed": "dalmatian"})
        assert r.status_code == 200
        assert r.json()["status"] == "recorded"

    def test_get_viewed_empty(self):
        r = client.get("/viewed")
        assert r.json() == []

    def test_viewed_upsert(self):
        client.post("/viewed", json={"breed": "dalmatian"})
        client.post("/viewed", json={"breed": "dalmatian"})
        r = client.get("/viewed")
        breeds = [v["breed"] for v in r.json()]
        assert breeds.count("dalmatian") == 1

    def test_viewed_max_5(self):
        for i in range(8):
            client.post("/viewed", json={"breed": f"breed{i}"})
        r = client.get("/viewed")
        assert len(r.json()) <= 5

    def test_viewed_returns_most_recent(self):
        for b in ["a", "b", "c", "d", "e", "f"]:
            client.post("/viewed", json={"breed": b})
        r = client.get("/viewed")
        names = [v["breed"] for v in r.json()]
        assert "f" in names


# ─── Stats ─────────────────────────────────────────
class TestStats:
    def setup_method(self):
        reset_db()

    def test_stats_zero(self):
        r = client.get("/stats")
        d = r.json()
        assert d["total_likes"] == 0
        assert d["total_viewed_breeds"] == 0

    def test_stats_counts(self):
        client.post("/like", json={"image_url": "http://x.com/1.jpg", "breed": "akita"})
        client.post("/viewed", json={"breed": "akita"})
        r = client.get("/stats")
        d = r.json()
        assert d["total_likes"] == 1
        assert d["total_viewed_breeds"] == 1
        assert d["top_liked_breed"] == "akita"


# ─── Prefetch ───────────────────────────────────────
class TestPrefetch:
    def test_prefetch_returns_immediately(self):
        r = client.get("/prefetch/labrador")
        assert r.status_code == 200
        assert r.json()["status"] == "prefetching"

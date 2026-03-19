"""
PostStager – Local Instagram Post Organizer
Run with: python app.py
Opens automatically in your default browser at http://localhost:5555
"""

import io
import json
import os
import shutil
import sqlite3
import uuid
import webbrowser
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from threading import Timer

from flask import Flask, g, jsonify, render_template, request, send_file, send_from_directory
from PIL import Image

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
IMAGES_DIR = DATA_DIR / "images"
DB_PATH = DATA_DIR / "poststager.db"
THUMBNAIL_SIZE = (600, 750)

IMAGES_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB upload limit


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(str(DB_PATH))
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(str(DB_PATH))
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS posts (
            id            TEXT PRIMARY KEY,
            status        TEXT NOT NULL DEFAULT 'pending',
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL,
            original_prompt    TEXT NOT NULL DEFAULT '',
            instagram_caption  TEXT NOT NULL DEFAULT '',
            notes              TEXT NOT NULL DEFAULT '',
            images        TEXT NOT NULL DEFAULT '[]',
            cover_index   INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    db.commit()
    db.close()


def row_to_dict(row):
    d = dict(row)
    d["images"] = json.loads(d["images"])
    return d


# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------
def save_uploaded_image(file_storage):
    """Save an uploaded image, create a thumbnail, return the filename."""
    ext = Path(file_storage.filename).suffix.lower()
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"):
        ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = IMAGES_DIR / filename

    file_storage.save(str(filepath))

    # Create thumbnail
    try:
        with Image.open(filepath) as img:
            img = img.convert("RGB")
            img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            thumb_path = IMAGES_DIR / f"thumb_{filename}"
            # Save thumbnail as JPEG for consistency
            thumb_name = f"thumb_{Path(filename).stem}.jpg"
            thumb_path = IMAGES_DIR / thumb_name
            img.save(str(thumb_path), "JPEG", quality=85)
    except Exception:
        pass  # If thumbnail fails, we still have the original

    return filename


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/posts", methods=["GET"])
def list_posts():
    status = request.args.get("status", "all")
    search = request.args.get("search", "").strip()
    db = get_db()

    query = "SELECT * FROM posts"
    params = []
    conditions = []

    if status in ("pending", "posted"):
        conditions.append("status = ?")
        params.append(status)

    if search:
        conditions.append(
            "(original_prompt LIKE ? OR instagram_caption LIKE ? OR notes LIKE ?)"
        )
        like = f"%{search}%"
        params.extend([like, like, like])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_at DESC"
    rows = db.execute(query, params).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/posts", methods=["POST"])
def create_post():
    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "At least one image is required"}), 400

    filenames = []
    for f in files:
        if f.filename:
            filenames.append(save_uploaded_image(f))

    if not filenames:
        return jsonify({"error": "No valid images uploaded"}), 400

    now = datetime.now(timezone.utc).isoformat()
    post_id = uuid.uuid4().hex

    db = get_db()
    db.execute(
        """INSERT INTO posts (id, status, created_at, updated_at, images)
           VALUES (?, 'pending', ?, ?, ?)""",
        (post_id, now, now, json.dumps(filenames)),
    )
    db.commit()

    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.route("/api/posts/<post_id>", methods=["GET"])
def get_post(post_id):
    db = get_db()
    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404
    return jsonify(row_to_dict(row))


@app.route("/api/posts/<post_id>", methods=["PUT"])
def update_post(post_id):
    db = get_db()
    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404

    data = request.get_json()
    now = datetime.now(timezone.utc).isoformat()

    fields = []
    params = []

    for field in ("status", "original_prompt", "instagram_caption", "notes"):
        if field in data:
            fields.append(f"{field} = ?")
            params.append(data[field])

    if "images" in data:
        fields.append("images = ?")
        params.append(json.dumps(data["images"]))

    if "cover_index" in data:
        fields.append("cover_index = ?")
        params.append(int(data["cover_index"]))

    if not fields:
        return jsonify(row_to_dict(row))

    fields.append("updated_at = ?")
    params.append(now)
    params.append(post_id)

    db.execute(f"UPDATE posts SET {', '.join(fields)} WHERE id = ?", params)
    db.commit()

    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/posts/<post_id>", methods=["DELETE"])
def delete_post(post_id):
    db = get_db()
    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404

    # Delete image files
    images = json.loads(row["images"])
    for img in images:
        for path in [IMAGES_DIR / img, IMAGES_DIR / f"thumb_{Path(img).stem}.jpg"]:
            try:
                path.unlink(missing_ok=True)
            except Exception:
                pass

    db.execute("DELETE FROM posts WHERE id = ?", (post_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/posts/<post_id>/images", methods=["POST"])
def add_images(post_id):
    db = get_db()
    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404

    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "No images provided"}), 400

    images = json.loads(row["images"])
    for f in files:
        if f.filename:
            images.append(save_uploaded_image(f))

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE posts SET images = ?, updated_at = ? WHERE id = ?",
        (json.dumps(images), now, post_id),
    )
    db.commit()

    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/posts/<post_id>/images/<filename>", methods=["DELETE"])
def remove_image(post_id, filename):
    db = get_db()
    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404

    images = json.loads(row["images"])
    if filename not in images:
        return jsonify({"error": "Image not in post"}), 404

    images.remove(filename)
    if not images:
        return jsonify({"error": "Cannot remove the last image"}), 400

    cover_index = row["cover_index"]
    if cover_index >= len(images):
        cover_index = 0

    now = datetime.now(timezone.utc).isoformat()
    db.execute(
        "UPDATE posts SET images = ?, cover_index = ?, updated_at = ? WHERE id = ?",
        (json.dumps(images), cover_index, now, post_id),
    )
    db.commit()

    # Delete files
    for path in [IMAGES_DIR / filename, IMAGES_DIR / f"thumb_{Path(filename).stem}.jpg"]:
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass

    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/posts/<post_id>/download")
def download_images(post_id):
    db = get_db()
    row = db.execute("SELECT * FROM posts WHERE id = ?", (post_id,)).fetchone()
    if not row:
        return jsonify({"error": "Not found"}), 404

    images = json.loads(row["images"])
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, img in enumerate(images, 1):
            img_path = IMAGES_DIR / img
            if img_path.exists():
                ext = Path(img).suffix or ".jpg"
                zf.write(str(img_path), f"image_{i}{ext}")
    buf.seek(0)
    return send_file(buf, mimetype="application/zip", as_attachment=True,
                     download_name=f"post_{post_id[:8]}_images.zip")


@app.route("/images/<filename>")
def serve_image(filename):
    return send_from_directory(str(IMAGES_DIR), filename)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    port = 5555
    url = f"http://localhost:{port}"
    print(f"\n  PostStager is running at: {url}\n")
    Timer(1.5, lambda: webbrowser.open(url)).start()
    app.run(host="127.0.0.1", port=port, debug=False)

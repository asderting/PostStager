# PostStager

A local visual organizer for Instagram posts you haven't published yet. No cloud, no accounts, no signup — everything stays on your computer.

![Grid View → Detail View]

## What It Does

- **Create posts** with one or more images (carousel support)
- **Grid view** showing thumbnails with Pending/Posted badges
- **Detail view** with image carousel and three text fields (Original Prompt, Instagram Caption, Notes) each with a Copy button
- **Filter** between Pending and Posted with one click
- **Search** across all your text fields
- Images are **copied into the app's folder** so you can safely delete originals

---

## Setup (One-Time)

### Prerequisites

You need **Python 3.9+** installed on your computer.

- **Windows**: Download from [python.org](https://www.python.org/downloads/). During install, **check the box "Add Python to PATH"**.
- **Mac**: Open Terminal and run `brew install python3` (if you have Homebrew), or download from [python.org](https://www.python.org/downloads/).
- **Linux**: Python is usually pre-installed. If not: `sudo apt install python3 python3-venv python3-pip`

### Install & Run

**Mac / Linux:**
```
Open Terminal, navigate to the PostStager folder, then run:

./start.sh
```

**Windows:**
```
Double-click start.bat
```

That's it! The first time, it will install dependencies (takes ~30 seconds). Then it opens automatically in your browser.

---

## How to Use

### Creating a Post
1. Click **+ New Post** (top right)
2. Select one or more images from your computer
3. The post is created and opens automatically
4. Fill in the text fields and click **Save**

### Browsing Posts
- The main screen shows all your posts as a grid of thumbnails
- Click **Pending** or **Posted** to filter
- Click any tile to open the detail view

### Detail View
- Browse images with the left/right arrows (or arrow keys)
- **Copy** buttons copy each text field to your clipboard (preserves line breaks)
- **Mark as Posted** toggles the status
- **Save** saves your text changes
- **Set as Cover** changes which image shows in the grid
- **Add Images** adds more images to the post
- **Remove Image** removes the currently shown image
- **Delete Post** permanently deletes the post and its images

### Keyboard Shortcuts
- **Left/Right arrows**: Navigate carousel images
- **Escape**: Close detail view

---

## Folder Structure

```
PostStager/
├── app.py              ← Main application
├── requirements.txt    ← Python dependencies
├── start.sh            ← Start script (Mac/Linux)
├── start.bat           ← Start script (Windows)
├── templates/          ← HTML template
├── static/             ← CSS and JavaScript
└── data/               ← YOUR DATA (created on first run)
    ├── poststager.db   ← Database (all your post info)
    └── images/         ← All your imported images
```

---

## Backing Up Your Data

To back up everything, just **copy the entire `data/` folder** somewhere safe. That folder contains your database and all your images. To restore, just copy it back.

---

## FAQ

**Q: Can I move the app to another computer?**
A: Yes! Copy the entire PostStager folder (including `data/`). Install Python on the new computer and run the start script.

**Q: What port does it use?**
A: It runs on `localhost:5555`. If that port is busy, you can change it in `app.py` (look for `port = 5555`).

**Q: Does it upload anything to the internet?**
A: No. Everything stays 100% on your computer. It doesn't connect to any external service.

/* ============================================================
   PostStager – Frontend Logic
   ============================================================ */

(function () {
    "use strict";

    // --- State ---
    let posts = [];
    let currentFilter = "all";
    let currentSearch = "";
    let currentPost = null;   // post object open in modal
    let carouselIndex = 0;

    // --- DOM refs ---
    const grid = document.getElementById("posts-grid");
    const emptyState = document.getElementById("empty-state");
    const modal = document.getElementById("detail-modal");
    const searchInput = document.getElementById("search-input");

    // Carousel
    const carouselTrack = document.getElementById("carousel-track");
    const carouselDots = document.getElementById("carousel-dots");
    const carouselPrev = document.getElementById("carousel-prev");
    const carouselNext = document.getElementById("carousel-next");
    const imageCounter = document.getElementById("image-counter");

    // Fields
    const fieldPrompt = document.getElementById("field-prompt");
    const fieldCaption = document.getElementById("field-caption");
    const fieldNotes = document.getElementById("field-notes");

    // Buttons
    const btnSave = document.getElementById("btn-save");
    const btnToggleStatus = document.getElementById("btn-toggle-status");
    const btnDeletePost = document.getElementById("btn-delete-post");
    const btnSetCover = document.getElementById("btn-set-cover");
    const btnRemoveImage = document.getElementById("btn-remove-image");
    const btnDownloadAll = document.getElementById("btn-download-all");
    const addImagesInput = document.getElementById("add-images-input");

    // ---------------------------------------------------------------
    // API helpers
    // ---------------------------------------------------------------
    async function api(url, opts = {}) {
        const res = await fetch(url, opts);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Request failed (${res.status})`);
        }
        return res.json();
    }

    // ---------------------------------------------------------------
    // Toast
    // ---------------------------------------------------------------
    let toastTimer = null;
    function showToast(msg) {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.style.display = "block";
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.style.display = "none"; }, 2200);
    }

    // ---------------------------------------------------------------
    // Grid rendering
    // ---------------------------------------------------------------
    async function loadPosts() {
        const params = new URLSearchParams();
        if (currentFilter !== "all") params.set("status", currentFilter);
        if (currentSearch) params.set("search", currentSearch);
        posts = await api(`/api/posts?${params}`);
        renderGrid();
    }

    function thumbUrl(filename) {
        const stem = filename.replace(/\.[^.]+$/, "");
        return `/images/thumb_${stem}.jpg`;
    }

    function renderGrid() {
        if (posts.length === 0) {
            grid.innerHTML = "";
            emptyState.style.display = "block";
            return;
        }
        emptyState.style.display = "none";

        grid.innerHTML = posts.map(p => {
            const cover = p.images[p.cover_index] || p.images[0];
            const badgeClass = p.status === "posted" ? "badge-posted" : "badge-pending";
            const badgeText = p.status === "posted" ? "Posted" : "Pending";
            const multiIndicator = p.images.length > 1
                ? `<span class="carousel-indicator">${p.images.length}</span>`
                : "";

            return `
                <div class="grid-tile" data-id="${p.id}">
                    <img src="${thumbUrl(cover)}"
                         alt="Post cover"
                         loading="lazy"
                         draggable="false"
                         onerror="this.src='/images/${cover}'">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    ${multiIndicator}
                </div>`;
        }).join("");

        // Attach click handlers
        grid.querySelectorAll(".grid-tile").forEach(tile => {
            tile.addEventListener("click", () => openPost(tile.dataset.id));
        });
    }

    // ---------------------------------------------------------------
    // Detail modal
    // ---------------------------------------------------------------
    function openPost(id) {
        currentPost = posts.find(p => p.id === id);
        if (!currentPost) return;

        // Populate fields
        fieldPrompt.value = currentPost.original_prompt;
        fieldCaption.value = currentPost.instagram_caption;
        fieldNotes.value = currentPost.notes;

        // Status button
        updateStatusButton();

        // Carousel
        carouselIndex = currentPost.cover_index || 0;
        renderCarousel();

        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        modal.style.display = "none";
        document.body.style.overflow = "";
        currentPost = null;
    }

    function updateStatusButton() {
        if (currentPost.status === "posted") {
            btnToggleStatus.textContent = "Mark as Pending";
            btnToggleStatus.classList.add("btn-primary");
        } else {
            btnToggleStatus.textContent = "Mark as Posted";
            btnToggleStatus.classList.remove("btn-primary");
        }
    }

    // ---------------------------------------------------------------
    // Carousel
    // ---------------------------------------------------------------
    function renderCarousel() {
        const imgs = currentPost.images;
        carouselTrack.innerHTML = imgs.map(f =>
            `<img src="/images/${f}" alt="Post image" draggable="false">`
        ).join("");

        // Dots
        carouselDots.innerHTML = imgs.map((_, i) =>
            `<button class="carousel-dot ${i === carouselIndex ? 'active' : ''}" data-i="${i}"></button>`
        ).join("");
        carouselDots.querySelectorAll(".carousel-dot").forEach(dot => {
            dot.addEventListener("click", () => {
                carouselIndex = parseInt(dot.dataset.i, 10);
                updateCarousel();
            });
        });

        updateCarousel();

        // Hide arrows if single image
        const single = imgs.length <= 1;
        carouselPrev.style.display = single ? "none" : "";
        carouselNext.style.display = single ? "none" : "";
        carouselDots.style.display = single ? "none" : "";
    }

    function updateCarousel() {
        const imgs = currentPost.images;
        if (carouselIndex < 0) carouselIndex = imgs.length - 1;
        if (carouselIndex >= imgs.length) carouselIndex = 0;

        carouselTrack.style.transform = `translateX(-${carouselIndex * 100}%)`;
        imageCounter.textContent = `${carouselIndex + 1} / ${imgs.length}`;

        // Update dots
        carouselDots.querySelectorAll(".carousel-dot").forEach((dot, i) => {
            dot.classList.toggle("active", i === carouselIndex);
        });
    }

    // ---------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------

    // New Post
    document.getElementById("new-post-btn").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.accept = "image/*";
        input.addEventListener("change", async () => {
            if (!input.files.length) return;
            const form = new FormData();
            for (const f of input.files) form.append("images", f);
            try {
                const newPost = await api("/api/posts", { method: "POST", body: form });
                await loadPosts();
                openPost(newPost.id);
                showToast("Post created!");
            } catch (e) {
                showToast("Error: " + e.message);
            }
        });
        input.click();
    });

    // Save
    btnSave.addEventListener("click", async () => {
        if (!currentPost) return;
        try {
            currentPost = await api(`/api/posts/${currentPost.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    original_prompt: fieldPrompt.value,
                    instagram_caption: fieldCaption.value,
                    notes: fieldNotes.value,
                }),
            });
            await loadPosts();
            showToast("Saved!");
        } catch (e) {
            showToast("Error: " + e.message);
        }
    });

    // Toggle status
    btnToggleStatus.addEventListener("click", async () => {
        if (!currentPost) return;
        const newStatus = currentPost.status === "posted" ? "pending" : "posted";
        try {
            currentPost = await api(`/api/posts/${currentPost.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            updateStatusButton();
            await loadPosts();
            showToast(newStatus === "posted" ? "Marked as Posted!" : "Marked as Pending");
        } catch (e) {
            showToast("Error: " + e.message);
        }
    });

    // Delete post
    btnDeletePost.addEventListener("click", async () => {
        if (!currentPost) return;
        if (!confirm("Delete this post and its images? This cannot be undone.")) return;
        try {
            await api(`/api/posts/${currentPost.id}`, { method: "DELETE" });
            closeModal();
            await loadPosts();
            showToast("Post deleted");
        } catch (e) {
            showToast("Error: " + e.message);
        }
    });

    // Set cover
    btnSetCover.addEventListener("click", async () => {
        if (!currentPost) return;
        try {
            currentPost = await api(`/api/posts/${currentPost.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cover_index: carouselIndex }),
            });
            await loadPosts();
            showToast("Cover updated!");
        } catch (e) {
            showToast("Error: " + e.message);
        }
    });

    // Remove image
    btnRemoveImage.addEventListener("click", async () => {
        if (!currentPost) return;
        const img = currentPost.images[carouselIndex];
        if (!confirm("Remove this image from the post?")) return;
        try {
            currentPost = await api(`/api/posts/${currentPost.id}/images/${img}`, {
                method: "DELETE",
            });
            carouselIndex = Math.min(carouselIndex, currentPost.images.length - 1);
            renderCarousel();
            await loadPosts();
            showToast("Image removed");
        } catch (e) {
            showToast("Error: " + e.message);
        }
    });

    // Add images
    addImagesInput.addEventListener("change", async () => {
        if (!currentPost || !addImagesInput.files.length) return;
        const form = new FormData();
        for (const f of addImagesInput.files) form.append("images", f);
        try {
            currentPost = await api(`/api/posts/${currentPost.id}/images`, {
                method: "POST",
                body: form,
            });
            renderCarousel();
            await loadPosts();
            showToast("Images added!");
        } catch (e) {
            showToast("Error: " + e.message);
        }
        addImagesInput.value = "";
    });

    // Download all images
    btnDownloadAll.addEventListener("click", () => {
        if (!currentPost) return;
        window.location.href = `/api/posts/${currentPost.id}/download`;
    });

    // Carousel navigation
    carouselPrev.addEventListener("click", () => { carouselIndex--; updateCarousel(); });
    carouselNext.addEventListener("click", () => { carouselIndex++; updateCarousel(); });

    // Copy buttons
    document.querySelectorAll(".copy-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = document.getElementById(btn.dataset.target);
            if (!target) return;
            navigator.clipboard.writeText(target.value).then(() => {
                btn.textContent = "Copied!";
                btn.classList.add("copied");
                setTimeout(() => {
                    btn.textContent = "Copy";
                    btn.classList.remove("copied");
                }, 1500);
            });
        });
    });

    // Close modal
    document.getElementById("modal-close").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.style.display !== "none") closeModal();
        if (modal.style.display !== "none" && currentPost && currentPost.images.length > 1) {
            if (e.key === "ArrowLeft") { carouselIndex--; updateCarousel(); }
            if (e.key === "ArrowRight") { carouselIndex++; updateCarousel(); }
        }
    });

    // Filter buttons
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.filter;
            loadPosts();
        });
    });

    // Search
    let searchTimer = null;
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentSearch = searchInput.value.trim();
            loadPosts();
        }, 300);
    });

    // ---------------------------------------------------------------
    // Drag & Drop – shared helpers
    // ---------------------------------------------------------------
    const dropOverlay = document.getElementById("drop-overlay");
    let dragCounter = 0;

    // Only accept external file drops (not images dragged from within the app)
    let internalDrag = false;

    // Mark any drag starting from inside the app as internal
    document.addEventListener("dragstart", (e) => {
        internalDrag = true;
    });
    document.addEventListener("dragend", (e) => {
        internalDrag = false;
    });

    function isExternalFileDrop(dt) {
        if (internalDrag) return false;
        return dt.types && dt.types.indexOf("Files") !== -1;
    }

    function getImageFiles(dt) {
        const files = [];
        for (const f of dt.files) {
            if (f.type.startsWith("image/")) files.push(f);
        }
        return files;
    }

    // ---------------------------------------------------------------
    // Drag & Drop – Grid (create new post)
    // ---------------------------------------------------------------

    // Show overlay when dragging external files over the page (only when modal is closed)
    document.addEventListener("dragenter", (e) => {
        if (modal.style.display !== "none") return;
        if (!isExternalFileDrop(e.dataTransfer)) return;
        e.preventDefault();
        dragCounter++;
        dropOverlay.style.display = "flex";
    });

    document.addEventListener("dragleave", (e) => {
        if (modal.style.display !== "none") return;
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            dropOverlay.style.display = "none";
        }
    });

    document.addEventListener("dragover", (e) => {
        if (modal.style.display !== "none") return;
        if (internalDrag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    });

    document.addEventListener("drop", async (e) => {
        if (modal.style.display !== "none") return;
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.style.display = "none";

        if (internalDrag) return;

        const files = getImageFiles(e.dataTransfer);
        if (files.length === 0) return;

        const form = new FormData();
        for (const f of files) form.append("images", f);
        try {
            const newPost = await api("/api/posts", { method: "POST", body: form });
            await loadPosts();
            openPost(newPost.id);
            showToast(`Post created with ${files.length} image${files.length > 1 ? "s" : ""}!`);
        } catch (err) {
            showToast("Error: " + err.message);
        }
    });

    // ---------------------------------------------------------------
    // Drag & Drop – Carousel (add images to existing post)
    // ---------------------------------------------------------------
    const carouselDropZone = document.getElementById("carousel-drop-zone");
    const carouselDropHint = document.getElementById("carousel-drop-hint");
    let carouselDragCounter = 0;

    carouselDropZone.addEventListener("dragenter", (e) => {
        if (!currentPost) return;
        if (internalDrag) return;
        if (!isExternalFileDrop(e.dataTransfer)) return;
        e.preventDefault();
        e.stopPropagation();
        carouselDragCounter++;
        carouselDropHint.style.display = "flex";
    });

    carouselDropZone.addEventListener("dragleave", (e) => {
        e.stopPropagation();
        carouselDragCounter--;
        if (carouselDragCounter <= 0) {
            carouselDragCounter = 0;
            carouselDropHint.style.display = "none";
        }
    });

    carouselDropZone.addEventListener("dragover", (e) => {
        if (!currentPost) return;
        if (internalDrag) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "copy";
    });

    carouselDropZone.addEventListener("drop", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        carouselDragCounter = 0;
        carouselDropHint.style.display = "none";
        if (!currentPost) return;
        if (internalDrag) return;

        const files = getImageFiles(e.dataTransfer);
        if (files.length === 0) return;

        const form = new FormData();
        for (const f of files) form.append("images", f);
        try {
            currentPost = await api(`/api/posts/${currentPost.id}/images`, {
                method: "POST",
                body: form,
            });
            renderCarousel();
            await loadPosts();
            showToast(`${files.length} image${files.length > 1 ? "s" : ""} added!`);
        } catch (err) {
            showToast("Error: " + err.message);
        }
    });

    // Prevent the page-level drop handler from firing when dropping on the modal
    modal.addEventListener("dragenter", (e) => { e.stopPropagation(); });
    modal.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
    modal.addEventListener("drop", (e) => { e.stopPropagation(); });

    // --- Init ---
    loadPosts();
})();

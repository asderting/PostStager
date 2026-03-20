/* ============================================================
   PostStager – Frontend Logic (Redesigned UI)
   ============================================================ */

(function () {
    "use strict";

    // --- State ---
    let posts = [];
    let allPosts = []; // unfiltered for counts
    let accounts = [];
    let currentFilter = "all";
    let currentSearch = "";
    let currentAccountId = null; // null = show all accounts
    let currentPost = null;
    let carouselIndex = 0;

    // Avatar colors
    const avatarColors = [
        "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
        "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
    ];

    // --- DOM refs ---
    const grid = document.getElementById("posts-grid");
    const emptyState = document.getElementById("empty-state");
    const modal = document.getElementById("detail-modal");
    const searchInput = document.getElementById("search-input");
    const pageTitle = document.getElementById("page-title");
    const postCountLabel = document.getElementById("post-count-label");

    // Counters
    const countAll = document.getElementById("count-all");
    const countPending = document.getElementById("count-pending");
    const countPosted = document.getElementById("count-posted");

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

    // Account list
    const accountList = document.getElementById("account-list");
    const btnAddAccount = document.getElementById("btn-add-account");

    // Page title map
    const filterTitles = {
        all: "All Posts",
        pending: "Pending",
        posted: "Posted",
    };

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
        const textEl = document.getElementById("toast-text");
        textEl.textContent = msg;
        t.style.display = "flex";
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.style.display = "none"; }, 2200);
    }

    // ---------------------------------------------------------------
    // Accounts
    // ---------------------------------------------------------------
    function getAvatarColor(index) {
        return avatarColors[index % avatarColors.length];
    }

    async function loadAccounts() {
        accounts = await api("/api/accounts");
        renderAccountList();
    }

    function renderAccountList() {
        accountList.innerHTML = accounts.map((acc, i) => {
            const active = currentAccountId === acc.id ? "active" : "";
            const initial = acc.name.charAt(0);
            const color = getAvatarColor(i);
            return `
                <div class="account-item">
                    <button class="nav-item ${active}" data-account-id="${acc.id}">
                        <span class="account-avatar" style="background:${color}">${initial}</span>
                        <span>${acc.name.replace(/</g, "&lt;")}</span>
                    </button>
                    <div class="account-actions">
                        <button class="account-action-btn" data-rename="${acc.id}" title="Rename">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="account-action-btn danger" data-delete-account="${acc.id}" title="Delete">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>`;
        }).join("");

        // Account click handlers
        accountList.querySelectorAll(".nav-item[data-account-id]").forEach(btn => {
            btn.addEventListener("click", () => {
                const id = btn.dataset.accountId;
                if (currentAccountId === id) {
                    // Deselect: go back to all
                    currentAccountId = null;
                } else {
                    currentAccountId = id;
                }
                updateActiveStates();
                loadPosts();
            });
        });

        // Rename handlers
        accountList.querySelectorAll("[data-rename]").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const id = btn.dataset.rename;
                const acc = accounts.find(a => a.id === id);
                if (!acc) return;
                const name = prompt("Rename account:", acc.name);
                if (!name || !name.trim()) return;
                try {
                    await api(`/api/accounts/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: name.trim() }),
                    });
                    await loadAccounts();
                    showToast("Account renamed!");
                } catch (err) {
                    showToast("Error: " + err.message);
                }
            });
        });

        // Delete handlers
        accountList.querySelectorAll("[data-delete-account]").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                e.stopPropagation();
                const id = btn.dataset.deleteAccount;
                const acc = accounts.find(a => a.id === id);
                if (!acc) return;
                if (!confirm(`Delete account "${acc.name}" and all its posts? This cannot be undone.`)) return;
                try {
                    await api(`/api/accounts/${id}`, { method: "DELETE" });
                    if (currentAccountId === id) currentAccountId = null;
                    await loadAccounts();
                    await loadPosts();
                    showToast("Account deleted");
                } catch (err) {
                    showToast("Error: " + err.message);
                }
            });
        });
    }

    function updateActiveStates() {
        // Update filter nav items
        document.querySelectorAll(".sidebar-nav > .nav-item[data-filter]").forEach(b => {
            b.classList.toggle("active", currentAccountId === null && b.dataset.filter === currentFilter);
        });

        // Update account nav items
        accountList.querySelectorAll(".nav-item[data-account-id]").forEach(b => {
            b.classList.toggle("active", b.dataset.accountId === currentAccountId);
        });
    }

    // Add account
    btnAddAccount.addEventListener("click", async () => {
        const name = prompt("Account name (e.g. @myaccount):");
        if (!name || !name.trim()) return;
        try {
            await api("/api/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });
            await loadAccounts();
            showToast("Account added!");
        } catch (err) {
            showToast("Error: " + err.message);
        }
    });

    // ---------------------------------------------------------------
    // Grid rendering
    // ---------------------------------------------------------------
    async function loadPosts() {
        const params = new URLSearchParams();
        if (currentAccountId) params.set("account_id", currentAccountId);

        // Always load all posts for this account for counts
        allPosts = await api(`/api/posts?${params}`);
        updateCounts();

        if (currentFilter !== "all") params.set("status", currentFilter);
        if (currentSearch) params.set("search", currentSearch);
        posts = await api(`/api/posts?${params}`);
        renderGrid();

        // Update page title
        if (currentAccountId) {
            const acc = accounts.find(a => a.id === currentAccountId);
            pageTitle.textContent = acc ? acc.name : "Account";
        } else {
            pageTitle.textContent = filterTitles[currentFilter] || "All Posts";
        }
        postCountLabel.textContent = posts.length === 1 ? "1 post" : `${posts.length} posts`;
    }

    function updateCounts() {
        const pending = allPosts.filter(p => p.status === "pending").length;
        const posted = allPosts.filter(p => p.status === "posted").length;
        countAll.textContent = allPosts.length;
        countPending.textContent = pending;
        countPosted.textContent = posted;
    }

    function thumbUrl(filename) {
        const stem = filename.replace(/\.[^.]+$/, "");
        return `/images/thumb_${stem}.jpg`;
    }

    function truncate(text, maxLen) {
        if (!text || text.length <= maxLen) return text || "";
        return text.substring(0, maxLen).trim() + "...";
    }

    function renderGrid() {
        if (posts.length === 0) {
            grid.innerHTML = "";
            emptyState.style.display = "flex";
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
            const caption = truncate(p.instagram_caption, 60);
            const captionHtml = caption
                ? `<div class="tile-caption">${caption.replace(/</g, "&lt;")}</div>`
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
                    ${captionHtml}
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

        fieldPrompt.value = currentPost.original_prompt;
        fieldCaption.value = currentPost.instagram_caption;
        fieldNotes.value = currentPost.notes;

        updateStatusButton();

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
            btnToggleStatus.classList.remove("btn-secondary");
        } else {
            btnToggleStatus.textContent = "Mark as Posted";
            btnToggleStatus.classList.remove("btn-primary");
            btnToggleStatus.classList.add("btn-secondary");
        }
    }

    // ---------------------------------------------------------------
    // Carousel
    // ---------------------------------------------------------------
    function renderCarousel() {
        const imgs = currentPost.images;
        carouselTrack.innerHTML = imgs.map(f =>
            `<div class="carousel-slide"><img src="/images/${f}" alt="Post image" draggable="false"></div>`
        ).join("");

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
            if (currentAccountId) form.append("account_id", currentAccountId);
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
                const span = btn.querySelector("span");
                if (span) {
                    span.textContent = "Copied!";
                    btn.classList.add("copied");
                    setTimeout(() => {
                        span.textContent = "Copy";
                        btn.classList.remove("copied");
                    }, 1500);
                }
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

    // Sidebar navigation (filter buttons)
    document.querySelectorAll(".sidebar-nav > .nav-item[data-filter]").forEach(btn => {
        btn.addEventListener("click", () => {
            currentAccountId = null;
            currentFilter = btn.dataset.filter;
            updateActiveStates();
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

    let internalDrag = false;

    document.addEventListener("dragstart", () => { internalDrag = true; });
    document.addEventListener("dragend", () => { internalDrag = false; });

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
    document.addEventListener("dragenter", (e) => {
        if (modal.style.display !== "none") return;
        if (!isExternalFileDrop(e.dataTransfer)) return;
        e.preventDefault();
        dragCounter++;
        dropOverlay.style.display = "flex";
    });

    document.addEventListener("dragleave", () => {
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
        if (currentAccountId) form.append("account_id", currentAccountId);
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

    // Prevent page-level drop handler from firing on modal
    modal.addEventListener("dragenter", (e) => { e.stopPropagation(); });
    modal.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
    modal.addEventListener("drop", (e) => { e.stopPropagation(); });

    // --- Init ---
    loadAccounts().then(() => loadPosts());
})();

/* ==========================================================
   CareSphere - news.js
   ----------------------------------------------------------
   Reads from the API. Posts come from the news table, so
   anything published in the admin panel appears here, and
   drafts do not — the server decides that, not this file.

   Category colours reference the --cat-* tokens defined in
   news.css, so the palette lives in one place. The category
   names now match the ones the admin panel uses, so the two
   sides cannot disagree about what a post is filed under.

   The add and remove controls only appear for a signed-in
   admin. A visitor never sees them, and the API would refuse
   them anyway.
========================================================== */

const CATEGORY_LABELS = {
    "Education":   "Education",
    "Healthcare":  "Healthcare",
    "Green Cover": "Green Cover",
    "General":     "General"
};

const CATEGORY_ICONS = {
    "Education":   "fa-solid fa-book-open",
    "Healthcare":  "fa-solid fa-heart-pulse",
    "Green Cover": "fa-solid fa-seedling",
    "General":     "fa-solid fa-newspaper"
};

/* Reuses the existing --cat-* tokens rather than adding new ones. */
const CATEGORY_COLORS = {
    "Education":   { icon: "var(--cat-article)",    tagBg: "var(--cat-article-bg)",    tagText: "var(--cat-article)" },
    "Healthcare":  { icon: "var(--cat-success)",    tagBg: "var(--cat-success-bg)",    tagText: "var(--cat-success)" },
    "Green Cover": { icon: "var(--cat-volunteer)",  tagBg: "var(--cat-volunteer-bg)",  tagText: "var(--cat-volunteer)" },
    "General":     { icon: "var(--cat-newsletter)", tagBg: "var(--cat-newsletter-bg)", tagText: "var(--cat-newsletter)" }
};

const FALLBACK_CATEGORY = "General";

function categoryOf(post) {
    return CATEGORY_LABELS[post.category] ? post.category : FALLBACK_CATEGORY;
}

let posts = [];
let activeFilter = "all";
let lastFocused = null;

const grid = document.getElementById("blogGrid");
const emptyState = document.getElementById("emptyState");
const resultsCount = document.getElementById("resultsCount");
const filterBar = document.getElementById("filterBar");

function escapeHtml(str) {

    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;

}

/* Is the person looking at this page an admin? Controls whether the
   add and remove buttons are shown at all. */
function isAdmin() {

    const user = CSStore.session.get();
    return !!(user && (user.role === "admin" || user.role === "super_admin"));

}

/* "2026-07-28" -> "Jul 28, 2026" */
function prettyDate(value) {

    if (!value) return "";

    const d = new Date(value);
    if (isNaN(d)) return "";

    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

}

/* ==========================================================
   LOAD
========================================================== */

function setMessage(html) {

    grid.innerHTML = "";
    emptyState.style.display = "none";
    resultsCount.innerHTML = html;

}

function load() {

    setMessage("Loading updates\u2026");

    /* No status filter is passed. The API returns published posts to a
       visitor and drafts as well to an admin, so the same call serves
       both without this page having to know the rule. */
    return CSStore.find("news")
        .then(function (rows) {
            posts = rows;
            render();
        })
        .catch(function (err) {
            const message = err.status
                ? "Could not load updates right now."
                : "Can't reach the server. If you're running this locally, check the backend is started.";
            setMessage(escapeHtml(message));
        });

}

/* ==========================================================
   RENDER
========================================================== */

function render() {

    const visible = activeFilter === "all"
        ? posts
        : posts.filter(p => categoryOf(p) === activeFilter);

    const admin = isAdmin();

    grid.innerHTML = "";

    visible.forEach(p => {

        const category = categoryOf(p);

        const card = document.createElement("article");
        card.className = "blog-card";
        card.dataset.category = category;

        const removeButton = admin
            ? `<button class="remove-btn" data-id="${p._id}" title="Delete this update" aria-label="Delete ${escapeHtml(p.title)}">
                   <i class="fa-solid fa-xmark" aria-hidden="true"></i>
               </button>`
            : "";

        /* Posts written before the byline field existed have no author. */
        const byline = p.author ? escapeHtml(p.author) : "CareSphere";

        const draftFlag = p.status === "draft"
            ? ` <span class="post-date" style="color:var(--cs-coral-dark)">Draft</span>`
            : "";

        card.innerHTML = `
            ${removeButton}

            <div class="card-icon">
                <i class="${CATEGORY_ICONS[category]}" aria-hidden="true"></i>
            </div>

            <div class="card-meta">
                <span class="category-tag">${CATEGORY_LABELS[category]}</span>
                <span class="post-date">${escapeHtml(prettyDate(p.publishedAt || p.createdAt))}</span>${draftFlag}
            </div>

            <h3>${escapeHtml(p.title)}</h3>
            <p class="excerpt">${escapeHtml(p.excerpt || "")}</p>

            <div class="card-footer">
                <span class="author">${byline}</span>
                <button type="button" class="read-more-btn" data-id="${p._id}">Read More</button>
            </div>
        `;

        grid.appendChild(card);

    });

    emptyState.style.display = visible.length === 0 ? "block" : "none";

    resultsCount.textContent = activeFilter === "all"
        ? `Showing all updates (${posts.length})`
        : `Showing ${CATEGORY_LABELS[activeFilter]} (${visible.length})`;

    /* The add button is only useful to someone who can actually post. */
    const addBtn = document.getElementById("openModalBtn");
    if (addBtn) addBtn.style.display = admin ? "" : "none";

    /* The hover lift is handled entirely in news.css. The old inline
       transform handlers here fought the CSS transition. */

}

/* ==========================================================
   FILTER BAR
========================================================== */

filterBar.addEventListener("click", (e) => {

    const btn = e.target.closest(".filter-btn");
    if (!btn) return;

    filterBar.querySelectorAll(".filter-btn").forEach(b => {
        b.dataset.active = "false";
        b.setAttribute("aria-pressed", "false");
    });

    btn.dataset.active = "true";
    btn.setAttribute("aria-pressed", "true");

    activeFilter = btn.dataset.filter;
    render();

});

/* ==========================================================
   CARD ACTIONS
========================================================== */

grid.addEventListener("click", (e) => {

    const removeBtn = e.target.closest(".remove-btn");

    if (removeBtn) {

        const id = removeBtn.dataset.id;
        const post = posts.find(p => p._id === id);

        if (post && !confirm(`Delete "${post.title}" permanently?`)) return;

        removeBtn.disabled = true;

        CSStore.removeById("news", id)
            .then(function () {
                posts = posts.filter(p => p._id !== id);
                render();
            })
            .catch(function (err) {
                removeBtn.disabled = false;
                alert(err.detail || "Could not delete that post.");
            });

        return;

    }

    const readBtn = e.target.closest(".read-more-btn");

    if (readBtn) {

        const post = posts.find(p => p._id === readBtn.dataset.id);
        if (post) openReadModal(post);

    }

});

/* ==========================================================
   READ ARTICLE MODAL
========================================================== */

const readModalOverlay = document.getElementById("readModalOverlay");
const closeReadModalBtn = document.getElementById("closeReadModalBtn");
const readModalIcon = document.getElementById("readModalIcon");
const readModalCategory = document.getElementById("readModalCategory");
const readModalDate = document.getElementById("readModalDate");
const readModalTitle = document.getElementById("readModalTitle");
const readModalAuthor = document.getElementById("readModalAuthor");
const readModalBody = document.getElementById("readModalBody");
const readModalLink = document.getElementById("readModalLink");

function openReadModal(post) {

    lastFocused = document.activeElement;

    const category = categoryOf(post);
    const colors = CATEGORY_COLORS[category];

    readModalIcon.innerHTML = `<i class="${CATEGORY_ICONS[category]}" aria-hidden="true"></i>`;
    readModalIcon.style.background = colors.icon;

    readModalCategory.textContent = CATEGORY_LABELS[category];
    readModalCategory.style.background = colors.tagBg;
    readModalCategory.style.color = colors.tagText;

    readModalDate.textContent = prettyDate(post.publishedAt || post.createdAt);
    readModalTitle.textContent = post.title;
    readModalAuthor.textContent = `By ${post.author || "CareSphere"}`;

    const bodyText = post.body && post.body.trim() ? post.body : (post.excerpt || "");

    readModalBody.innerHTML = bodyText
        .split("\n")
        .filter(line => line.trim() !== "")
        .map(line => `<p>${escapeHtml(line)}</p>`)
        .join("");

    if (post.link && post.link !== "#") {
        readModalLink.href = post.link;
        readModalLink.style.display = "inline-flex";
    } else {
        readModalLink.style.display = "none";
    }

    readModalOverlay.dataset.open = "true";
    closeReadModalBtn.focus();
    document.addEventListener("keydown", onReadModalKeydown);

}

function closeReadModal() {

    readModalOverlay.dataset.open = "false";
    document.removeEventListener("keydown", onReadModalKeydown);

    if (lastFocused) {
        lastFocused.focus();
        lastFocused = null;
    }

}

function onReadModalKeydown(e) {

    if (e.key === "Escape") closeReadModal();

}

closeReadModalBtn.addEventListener("click", closeReadModal);

readModalOverlay.addEventListener("click", (e) => {

    if (e.target === readModalOverlay) closeReadModal();

});

/* ==========================================================
   ADD UPDATE MODAL  (admins only)
========================================================== */

const modalOverlay = document.getElementById("modalOverlay");
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const postForm = document.getElementById("postForm");

function postMessage(text, ok) {

    const el = document.getElementById("postFormMessage");
    if (!el) return;

    el.textContent = text;
    el.className = "form-message " + (ok ? "is-ok" : "is-error");

}

function openModal() {

    lastFocused = document.activeElement;
    modalOverlay.dataset.open = "true";
    document.getElementById("f-title").focus();
    document.addEventListener("keydown", onKeydown);

}

function closeModal() {

    modalOverlay.dataset.open = "false";
    document.removeEventListener("keydown", onKeydown);
    postForm.reset();
    postMessage("");

    if (lastFocused) {
        lastFocused.focus();
        lastFocused = null;
    }

}

function onKeydown(e) {

    if (e.key === "Escape") closeModal();

}

openModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

modalOverlay.addEventListener("click", (e) => {

    if (e.target === modalOverlay) closeModal();

});

postForm.addEventListener("submit", (e) => {

    e.preventDefault();

    const title = document.getElementById("f-title").value.trim();
    const category = document.getElementById("f-category").value;
    const author = document.getElementById("f-author").value.trim();
    const excerpt = document.getElementById("f-excerpt").value.trim();
    const content = document.getElementById("f-content").value.trim();
    const link = document.getElementById("f-link").value.trim();

    /* the form used to fail silently when a field was blank */
    if (!title || !author || !excerpt) {
        postMessage("Title, author and summary are all required.", false);
        return;
    }

    const submitBtn = postForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    postMessage("Saving\u2026", true);

    /* Posted straight to published — someone using this button is on the
       public page and expects the update to appear. Use the admin panel
       to save a draft instead. */
    CSStore.insert("news", {
        title: title,
        category: category,
        author: author,
        excerpt: excerpt,
        body: content,
        link: link || null,
        status: "published"
    })
        .then(function (created) {

            posts.unshift(created);
            activeFilter = categoryOf(created);

            filterBar.querySelectorAll(".filter-btn").forEach(b => {
                const on = b.dataset.filter === activeFilter;
                b.dataset.active = on ? "true" : "false";
                b.setAttribute("aria-pressed", on ? "true" : "false");
            });

            render();
            closeModal();

        })
        .catch(function (err) {
            postMessage(err.detail || "Could not save that post.", false);
        })
        .finally(function () {
            if (submitBtn) submitBtn.disabled = false;
        });

});

/* ==========================================================
   NEWSLETTER
========================================================== */

(function () {

    const form = document.getElementById("newsletterForm");
    const note = document.getElementById("newsletterNote");

    if (!form || !note) return;

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        const input = document.getElementById("newsletterEmail");
        const value = input.value.trim();
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!pattern.test(value)) {
            note.textContent = "That email address doesn't look right.";
            note.style.color = "#8C3B2E";
            input.focus();
            return;
        }

        note.textContent = "You're subscribed. Watch your inbox for our next update.";
        note.style.color = "#1C3149";
        form.reset();

    });

}());

/* ==========================================================
   INIT
========================================================== */

load();

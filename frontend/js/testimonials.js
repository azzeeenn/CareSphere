/* ==========================================================
   CareSphere — testimonials.js

   Reads approved stories from the API instead of holding a
   hardcoded list.

   GET /api/testimonials returns approved rows only to anyone
   who is not signed in as staff, so this page cannot show an
   unreviewed story even by accident. The filtering happens on
   the server, not here.

   There is no submit form on this page any more. Stories come
   from volunteers, through Share your story in the volunteer
   area, and an organiser approves them before they appear.
========================================================== */

let stories = [];
let activeFilter = "all";

const grid         = document.getElementById("testimonialsGrid");
const emptyState   = document.getElementById("emptyState");
const resultsCount = document.getElementById("resultsCount");
const filterBar    = document.getElementById("filterBar");

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : str;
    return div.innerHTML;
}

function initials(name) {
    return String(name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join("");
}

/* ==========================================================
   RENDER
========================================================== */

function render() {

    const visible = activeFilter === "featured"
        ? stories.filter(s => s.featured)
        : stories;

    grid.innerHTML = "";

    visible.forEach(s => {

        const card = document.createElement("article");
        card.className = "review-card";

        card.innerHTML = `
            <span class="category-tag">${s.featured ? "Featured Story" : "Volunteer Story"}</span>
            <div class="review-avatar">${escapeHtml(initials(s.name))}</div>
            <p class="review-text">${escapeHtml(s.body)}</p>
            <h4>${escapeHtml(s.name)}</h4>
            <span class="review-role">${escapeHtml(s.role || "")}</span>`;

        grid.appendChild(card);

    });

    emptyState.style.display = visible.length === 0 ? "block" : "none";

    resultsCount.textContent = activeFilter === "featured"
        ? `Showing featured stories (${visible.length})`
        : `Showing all stories (${visible.length})`;

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
   NEWSLETTER
========================================================== */

(function () {

    const form = document.getElementById("newsletterForm");
    const note = document.getElementById("newsletterNote");

    if (!form || !note) return;

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        const input   = document.getElementById("newsletterEmail");
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!pattern.test(input.value.trim())) {
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
   LOAD

   Newest first. The API already sorts by submitted date, but
   sorting here as well means the page is right even if that
   ever changes.
========================================================== */

CSStore.find("testimonials")
    .then(rows => {
        stories = rows.sort(
            (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
        );
        render();
    })
    .catch(() => {
        grid.innerHTML = "";
        emptyState.style.display = "block";
        emptyState.textContent =
            "Stories can't be loaded right now. Please try again shortly.";
        resultsCount.textContent = "";
    });

/* ==========================================================
   CareSphere - gallery.js
   ----------------------------------------------------------
   Filtering + lightbox.

   Fixes over the original:
     - the reveal animation and the filter animation were both
       writing inline opacity/transform to the same elements
       and cancelling each other out
     - gallery items were <div>s with click handlers, so they
       were unreachable by keyboard; they are <button>s now
     - the lightbox never moved focus, so a keyboard user was
       left behind on the page underneath
     - added null guards throughout
========================================================== */

(function () {

    "use strict";

    var grid = document.getElementById("galleryGrid");
    var lightbox = document.getElementById("lightbox");

    if (!grid || !lightbox) {
        return;
    }

    var filterButtons = document.querySelectorAll(".filter-btn");
    var galleryItems = Array.prototype.slice.call(
        grid.querySelectorAll(".gallery-item")
    );
    var emptyState = document.getElementById("emptyState");
    var filterCount = document.getElementById("filterCount");

    var lightboxImg = document.getElementById("lightbox-img");
    var lightboxTag = document.getElementById("lightbox-tag");
    var lightboxTitle = document.getElementById("lightbox-title");
    var lightboxCount = document.getElementById("lightbox-count");

    var closeBtn = document.getElementById("lightbox-close");
    var prevBtn = document.getElementById("lightbox-prev");
    var nextBtn = document.getElementById("lightbox-next");

    var visibleItems = galleryItems.slice();
    var currentIndex = 0;
    var lastFocused = null;

    var reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    /* ======================================================
       REVEAL
       Runs once on load. The filter no longer touches opacity,
       so the two animations can't fight each other.
    ====================================================== */

    function reveal() {

        if (reduceMotion || !("IntersectionObserver" in window)) {
            return;
        }

        var observer = new IntersectionObserver(function (entries) {

            entries.forEach(function (entry) {

                if (!entry.isIntersecting) {
                    return;
                }

                entry.target.style.opacity = "1";
                entry.target.style.transform = "none";
                observer.unobserve(entry.target);

            });

        }, { threshold: 0.1 });

        galleryItems.forEach(function (item, i) {

            item.style.opacity = "0";
            item.style.transform = "translateY(24px)";
            item.style.transition =
                "opacity .55s ease " + (i % 3) * 60 + "ms, " +
                "transform .55s ease " + (i % 3) * 60 + "ms";

            observer.observe(item);

        });

    }

    /* ======================================================
       FILTERING
    ====================================================== */

    function applyFilter(category) {

        visibleItems = [];

        galleryItems.forEach(function (item) {

            var matches = category === "all" ||
                item.dataset.category === category;

            item.classList.toggle("hidden", !matches);

            if (matches) {
                visibleItems.push(item);
            }

        });

        if (emptyState) {
            emptyState.classList.toggle("show", visibleItems.length === 0);
        }

        if (filterCount) {

            var label = category === "all"
                ? "photo"
                : category.charAt(0).toUpperCase() + category.slice(1) + " photo";

            filterCount.textContent = visibleItems.length === 0
                ? ""
                : "Showing " + visibleItems.length + " " + label +
                  (visibleItems.length === 1 ? "" : "s");

        }

    }

    filterButtons.forEach(function (btn) {

        btn.addEventListener("click", function () {

            filterButtons.forEach(function (b) {
                b.classList.remove("active");
                b.setAttribute("aria-pressed", "false");
            });

            btn.classList.add("active");
            btn.setAttribute("aria-pressed", "true");

            applyFilter(btn.dataset.filter);

        });

    });

    /* ======================================================
       LIGHTBOX
    ====================================================== */

    function updateLightbox() {

        var item = visibleItems[currentIndex];

        if (!item) {
            return;
        }

        var img = item.querySelector("img");
        var tag = item.querySelector(".cat-tag");
        var title = item.querySelector("h4");

        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt;

        if (tag) {
            lightboxTag.textContent = tag.textContent;
        }

        if (title) {
            lightboxTitle.textContent = title.textContent;
        }

        if (lightboxCount) {
            lightboxCount.textContent =
                (currentIndex + 1) + " of " + visibleItems.length;
        }

        /* only offer the arrows when there is somewhere to go */
        var many = visibleItems.length > 1;
        prevBtn.style.display = many ? "flex" : "none";
        nextBtn.style.display = many ? "flex" : "none";

    }

    function openLightbox(item) {

        currentIndex = visibleItems.indexOf(item);

        if (currentIndex === -1) {
            return;
        }

        lastFocused = document.activeElement;

        updateLightbox();

        lightbox.classList.add("open");
        document.body.style.overflow = "hidden";
        closeBtn.focus();

    }

    function closeLightbox() {

        lightbox.classList.remove("open");
        document.body.style.overflow = "";

        if (lastFocused) {
            lastFocused.focus();
            lastFocused = null;
        }

    }

    function showNext() {
        currentIndex = (currentIndex + 1) % visibleItems.length;
        updateLightbox();
    }

    function showPrev() {
        currentIndex =
            (currentIndex - 1 + visibleItems.length) % visibleItems.length;
        updateLightbox();
    }

    galleryItems.forEach(function (item) {
        item.addEventListener("click", function () {
            openLightbox(item);
        });
    });

    closeBtn.addEventListener("click", closeLightbox);
    nextBtn.addEventListener("click", showNext);
    prevBtn.addEventListener("click", showPrev);

    lightbox.addEventListener("click", function (e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    document.addEventListener("keydown", function (e) {

        if (!lightbox.classList.contains("open")) {
            return;
        }

        if (e.key === "Escape") {
            closeLightbox();
        }

        if (e.key === "ArrowRight") {
            showNext();
        }

        if (e.key === "ArrowLeft") {
            showPrev();
        }

        /* keep Tab inside the dialog while it is open */
        if (e.key === "Tab") {

            var focusable = [closeBtn, prevBtn, nextBtn].filter(function (el) {
                return el.style.display !== "none";
            });

            var first = focusable[0];
            var last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }

        }

    });

    /* ======================================================
       INIT
    ====================================================== */

    applyFilter("all");
    reveal();

}());

/* ==========================================================
   CareSphere - recognition.js

   The Hall of Fame used to be four names written into this
   file. It now comes from the recognition table, so whoever
   an organiser adds in the admin panel appears here.

   Only entries of type "Recognition" are volunteers. Awards
   are the same table with type "Award" and are shown on the
   impact dashboard instead.

   There are no photos. The table has no image column, and the
   old <img> tags pointed at files that don't exist, so each
   card shows the volunteer's initials instead.
========================================================== */

(function () {

    "use strict";

    const grid  = document.getElementById("hofGrid");
    const empty = document.getElementById("hofEmpty");

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

    function render(people) {

        if (!people.length) {
            grid.innerHTML = "";
            empty.hidden = false;
            return;
        }

        empty.hidden = true;

        grid.innerHTML = people.map(p => `
            <div class="hof-card">

                <div class="hof-initials" aria-hidden="true">${escapeHtml(initials(p.title))}</div>
                <h3>${escapeHtml(p.title)}</h3>
                <span>${p.year ? escapeHtml(String(p.year)) : ""}</span>
                <p>${escapeHtml(p.body || "")}</p>

            </div>`).join("");
    }

    document.addEventListener("DOMContentLoaded", function () {

        if (window.CareSphere) {
            window.CareSphere.reveal(
                ".cert-card, .badge-card, .reward-card",
                { threshold: 0.12 }
            );
        }

        if (!grid) return;

        CSStore.find("recognition", { type: "Recognition" })
            .then(rows => {
                /* Newest first, and a missing year sinks to the bottom
                   rather than breaking the sort. */
                rows.sort((a, b) => (b.year || 0) - (a.year || 0));
                render(rows);

                /* Reveal has to run after the cards exist. */
                if (window.CareSphere) {
                    window.CareSphere.reveal(".hof-card", { threshold: 0.12 });
                }
            })
            .catch(() => {
                grid.innerHTML = "";
                empty.hidden = false;
                empty.textContent = "This list can't be loaded right now.";
            });

    });

}());

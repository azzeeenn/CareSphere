/* ==========================================================
   CareSphere - impact-awards.js

   Draws the awards CareSphere has received onto the impact
   dashboard. They live in the recognition table with type
   "Award"; volunteers in the same table use type
   "Recognition" and appear on recognition.html instead.

   Kept out of impact-dashboard.js because that file handles
   the charts and this has nothing to do with them.

   No reveal() on these cards. That helper fades elements in
   when they scroll into view, and cards added afterwards can
   be left at zero opacity — visible in the DOM, invisible on
   screen. Not worth the risk for four cards.
========================================================== */

(function () {

    "use strict";

    const grid    = document.getElementById("awardsGrid");
    const section = document.getElementById("awardsSection");

    if (!grid || !section) return;

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str == null ? "" : str;
        return div.innerHTML;
    }

    document.addEventListener("DOMContentLoaded", function () {

        CSStore.find("recognition", { type: "Award" })
            .then(rows => {

                /* Nothing to show is not an error — hide the whole
                   section rather than leaving an empty heading. */
                if (!rows.length) {
                    section.style.display = "none";
                    return;
                }

                rows.sort((a, b) => (b.year || 0) - (a.year || 0));

                grid.innerHTML = rows.map(a => `
                    <div class="award-card">
                        <span class="award-year">${a.year ? escapeHtml(String(a.year)) : ""}</span>
                        <h3>${escapeHtml(a.title)}</h3>
                        <p>${escapeHtml(a.body || "")}</p>
                    </div>`).join("");
            })
            .catch(err => {
                console.error("Awards failed to load:", err);
                section.style.display = "none";
            });

    });

}());

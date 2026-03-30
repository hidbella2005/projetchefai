// ============================================================
// UI Utilities Module
// Toasts, view switching, dark mode, rendering helpers.
// ============================================================

const UI = {
    // ---- Toast Notifications ----
    showToast(message, type = "info") {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const icons = {
            success: "bi-check-circle-fill",
            danger: "bi-exclamation-triangle-fill",
            warning: "bi-exclamation-circle-fill",
            info: "bi-info-circle-fill"
        };
        const id = "toast-" + Date.now();
        const html = `
            <div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body"><i class="bi ${icons[type] || icons.info} me-2"></i>${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>`;
        container.insertAdjacentHTML("beforeend", html);
        const el = document.getElementById(id);
        const toast = new bootstrap.Toast(el, { delay: 4000 });
        toast.show();
        el.addEventListener("hidden.bs.toast", () => el.remove());
    },

    // ---- View Switching ----
    showView(viewId) {
        document.querySelectorAll(".view-section").forEach(v => {
            v.classList.add("d-none");
            v.classList.remove("d-block");
        });
        const target = document.getElementById("view-" + viewId);
        if (target) {
            target.classList.remove("d-none");
            target.classList.add("d-block");
            target.style.animation = "fadeSlideIn 0.35s ease forwards";
        }
        // Update sidebar active state
        document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
        const activeLink = document.querySelector(`.sidebar-link[data-view="${viewId}"]`);
        if (activeLink) activeLink.classList.add("active");
        // Update mobile bottom nav
        document.querySelectorAll(".bottom-nav-link").forEach(l => l.classList.remove("active"));
        const activeMob = document.querySelector(`.bottom-nav-link[data-view="${viewId}"]`);
        if (activeMob) activeMob.classList.add("active");
    },

    // ---- Dark Mode ----
    initDarkMode() {
        const saved = localStorage.getItem("darkMode");
        if (saved === "true") document.documentElement.setAttribute("data-theme", "dark");
        UI.updateDarkModeIcon();
    },

    toggleDarkMode() {
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        if (isDark) {
            document.documentElement.removeAttribute("data-theme");
            localStorage.setItem("darkMode", "false");
        } else {
            document.documentElement.setAttribute("data-theme", "dark");
            localStorage.setItem("darkMode", "true");
        }
        UI.updateDarkModeIcon();
    },

    updateDarkModeIcon() {
        const btn = document.getElementById("darkModeToggle");
        if (!btn) return;
        const isDark = document.documentElement.getAttribute("data-theme") === "dark";
        btn.innerHTML = isDark
            ? '<i class="bi bi-sun-fill"></i>'
            : '<i class="bi bi-moon-fill"></i>';
    },

    // ---- Greeting ----
    getGreeting(name) {
        const h = new Date().getHours();
        let greet = "Bonsoir";
        if (h < 12) greet = "Bonjour";
        else if (h < 18) greet = "Bon après-midi";
        return `${greet}, ${name || "Chef"}`;
    },

    // ---- Date Formatting ----
    formatDate(timestamp) {
        if (!timestamp) return "Date inconnue";
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleDateString("fr-FR", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    },

    getDateLabel(timestamp) {
        if (!timestamp) return "Inconnu";
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - d) / 86400000);
        if (diff === 0) return "Aujourd'hui";
        if (diff === 1) return "Hier";
        if (diff < 7) return "Cette semaine";
        return d.toLocaleDateString("fr-FR", { month: "long", day: "numeric", year: "numeric" });
    },

    // ---- Skeleton Loader ----
    renderSkeleton() {
        return `
        <div class="skeleton-card">
            <div class="skeleton-header">
                <div class="skeleton-line w-75 skeleton-title"></div>
                <div class="skeleton-line w-100"></div>
                <div class="skeleton-line w-50"></div>
            </div>
            <div class="skeleton-body">
                <div class="skeleton-badges">
                    <div class="skeleton-badge"></div>
                    <div class="skeleton-badge"></div>
                    <div class="skeleton-badge"></div>
                    <div class="skeleton-badge"></div>
                </div>
                <div class="skeleton-line w-100 mt-3"></div>
                <div class="skeleton-line w-100"></div>
                <div class="skeleton-line w-75"></div>
                <div class="skeleton-line w-100 mt-3"></div>
                <div class="skeleton-line w-100"></div>
                <div class="skeleton-line w-50"></div>
            </div>
        </div>`;
    },

    // ---- Recipe Card (for generated result) ----
    renderRecipeCard(recipe, recipeId) {
        const ingHtml = (recipe.ingredients || []).map(i => {
            const name = typeof i === "string" ? i : `${i.amount || ""} ${i.unit || ""} ${i.name || i}`.trim();
            return `<li>${name}</li>`;
        }).join("");

        const instrHtml = (recipe.instructions || []).map(i => {
            const text = typeof i === "string" ? i : i.text;
            return `<li>${text}</li>`;
        }).join("");

        const n = recipe.nutrition || {};
        const tagsHtml = (recipe.tags || []).map(t =>
            `<span class="badge bg-tag">${t}</span>`).join("");

        return `
        <div class="recipe-card animate-in" data-recipe-id="${recipeId || ''}">
            <div class="recipe-card-header">
                <div class="recipe-card-gradient"></div>
                <h2>${recipe.title || "Recette sans titre"}</h2>
                <p>${recipe.description || ""}</p>
                <button class="btn-bookmark" data-id="${recipeId}" data-saved="false" title="Favori">
                    <i class="bi bi-bookmark"></i>
                </button>
            </div>
            <div class="recipe-card-body">
                <div class="recipe-meta">
                    ${recipe.prepTime ? `<span class="meta-item"><i class="bi bi-clock"></i> Prépa : ${recipe.prepTime}</span>` : ""}
                    ${recipe.cookTime ? `<span class="meta-item"><i class="bi bi-fire"></i> Cuisson : ${recipe.cookTime}</span>` : ""}
                    ${recipe.difficulty ? `<span class="meta-item"><i class="bi bi-speedometer2"></i> ${recipe.difficulty}</span>` : ""}
                    ${recipe.servings ? `<span class="meta-item"><i class="bi bi-people"></i> ${recipe.servings} portions</span>` : ""}
                </div>
                <div class="tags-row">${tagsHtml}</div>
                <div class="nutrition-section">
                    ${n.calories ? `<span class="nutrition-badge nb-calories"><i class="bi bi-fire"></i> ${n.calories} cal</span>` : ""}
                    ${n.protein ? `<span class="nutrition-badge nb-protein"><i class="bi bi-droplet"></i> ${n.protein} protéines</span>` : ""}
                    ${n.carbs ? `<span class="nutrition-badge nb-carbs"><i class="bi bi-grain"></i> ${n.carbs} glucides</span>` : ""}
                    ${n.fat ? `<span class="nutrition-badge nb-fat"><i class="bi bi-egg-fried"></i> ${n.fat} lipides</span>` : ""}
                    ${n.fiber ? `<span class="nutrition-badge nb-fiber"><i class="bi bi-tree"></i> ${n.fiber} fibres</span>` : ""}
                </div>
                <h5 class="section-label"><i class="bi bi-basket2-fill"></i> Ingrédients</h5>
                <ul class="ingredient-list">${ingHtml}</ul>
                <h5 class="section-label mt-4"><i class="bi bi-list-ol"></i> Instructions</h5>
                <ol class="instruction-list">${instrHtml}</ol>
                <div class="recipe-actions mt-4">
                    <button class="btn btn-cook" data-id="${recipeId}"><i class="bi bi-fire"></i> Commencer à cuisiner</button>
                </div>
            </div>
        </div>`;
    },

    // ---- Saved Recipe Grid Card ----
    renderSavedCard(recipe) {
        const n = recipe.nutrition || {};
        const tagsHtml = (recipe.tags || []).slice(0, 3).map(t =>
            `<span class="badge bg-tag-sm">${t}</span>`).join("");
        return `
        <div class="col-md-6 col-xl-4">
            <div class="saved-card" data-recipe-id="${recipe.id}">
                <div class="saved-card-top">
                    <div class="saved-card-gradient"></div>
                    ${recipe.difficulty ? `<span class="difficulty-badge">${recipe.difficulty}</span>` : ""}
                </div>
                <div class="saved-card-body">
                    <h5>${recipe.title || "Sans titre"}</h5>
                    <p>${recipe.description ? recipe.description.substring(0, 80) + "..." : ""}</p>
                    <div class="tags-row-sm">${tagsHtml}</div>
                    <div class="saved-card-meta">
                        ${recipe.prepTime ? `<span><i class="bi bi-clock"></i> ${recipe.prepTime}</span>` : ""}
                        ${recipe.cookTime ? `<span><i class="bi bi-fire"></i> ${recipe.cookTime}</span>` : ""}
                    </div>
                </div>
                <div class="saved-card-actions">
                    <button class="btn btn-sm btn-view-recipe" data-id="${recipe.id}"><i class="bi bi-eye"></i> Voir</button>
                    <button class="btn btn-sm btn-bookmark-toggle ${recipe.isSaved ? 'bookmarked' : ''}" data-id="${recipe.id}" data-saved="${recipe.isSaved}">
                        <i class="bi ${recipe.isSaved ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i>
                    </button>
                    <button class="btn btn-sm btn-delete-recipe" data-id="${recipe.id}"><i class="bi bi-trash3"></i></button>
                </div>
            </div>
        </div>`;
    },

    // ---- Nutrition Bars (for detail modal) ----
    renderNutritionBars(nutrition) {
        if (!nutrition) return '<p class="text-muted">Aucune donnée nutritionnelle disponible.</p>';
        const items = [
            { key: "calories", label: "Calories", color: "amber", icon: "bi-fire", max: 800 },
            { key: "protein", label: "Protéines", color: "blue", icon: "bi-droplet", max: 60 },
            { key: "carbs", label: "Glucides", color: "green", icon: "bi-grain", max: 100 },
            { key: "fat", label: "Lipides", color: "red", icon: "bi-egg-fried", max: 50 },
            { key: "fiber", label: "Fibres", color: "teal", icon: "bi-tree", max: 30 }
        ];
        return items.map(item => {
            const val = parseInt(nutrition[item.key]) || 0;
            const pct = Math.min((val / item.max) * 100, 100);
            return `
            <div class="nutri-bar-row">
                <div class="nutri-bar-label">
                    <i class="bi ${item.icon}"></i>
                    <span>${item.label}</span>
                </div>
                <div class="nutri-bar-track">
                    <div class="nutri-bar-fill nutri-${item.color}" style="width:${pct}%"></div>
                </div>
                <span class="nutri-bar-val">${nutrition[item.key] || "–"}</span>
            </div>`;
        }).join("");
    },

    // ---- Set User UI ----
    setUserUI(user) {
        const nameEl = document.getElementById("userDisplayName");
        const avatarEl = document.getElementById("userAvatar");
        const avatarDropEl = document.getElementById("userAvatarDrop");
        if (nameEl) nameEl.textContent = user.displayName || "Chef";
        if (avatarEl) {
            avatarEl.src = user.photoURL || "";
            avatarEl.style.display = user.photoURL ? "block" : "none";
        }
        if (avatarDropEl) {
            avatarDropEl.src = user.photoURL || "";
            avatarDropEl.style.display = user.photoURL ? "block" : "none";
        }
        const initialsEl = document.getElementById("userInitials");
        if (initialsEl) {
            if (!user.photoURL) {
                const initials = (user.displayName || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
                initialsEl.textContent = initials;
                initialsEl.style.display = "flex";
            } else {
                initialsEl.style.display = "none";
            }
        }
    }
};

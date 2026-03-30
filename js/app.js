// ============================================================
// Main Application Controller (app.js)
// Orchestrates auth, views, events, and all features.
// ============================================================

(function () {
    "use strict";

    // ---- State ----
    let currentUser = null;
    let allRecipes = [];
    let unsubRecipes = null; // Firestore listener
    let ingredients = [];    // tag input state
    let genStep = 1;
    let cookingRecipe = null;
    let cookingStep = 0;
    let timerInterval = null;
    let timerSeconds = 0;
    let timerRunning = false;
    let deleteTargetId = null;

    // ---- Init ----
    document.addEventListener("DOMContentLoaded", () => {
        UI.initDarkMode();
        initAuth();
        initSidebar();
        initDarkMode();
        initGenerator();
        initRecipesView();
        initHistoryView();
        initSettingsView();
        initCookingMode();
    });

    // ============================================================
    // AUTH
    // ============================================================
    function initAuth() {
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = "index.html";
                return;
            }
            currentUser = user;
            Auth.currentUser = user;
            UI.setUserUI(user);
            loadDashboard();
            loadPreferences();
            // Start real-time recipe listener
            if (unsubRecipes) unsubRecipes();
            unsubRecipes = DB.listenToRecipes(user.uid, (recipes) => {
                allRecipes = recipes;
                renderDashboardStats(recipes);
                renderRecentRecipes(recipes);
                renderRecipesGrid(recipes);
            });
        });

        // Logout
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.addEventListener("click", (e) => { e.preventDefault(); Auth.logout(); });
    }

    // ============================================================
    // SIDEBAR & NAV
    // ============================================================
    function initSidebar() {
        // Sidebar links
        document.querySelectorAll(".sidebar-link, .bottom-nav-link, .dropdown-item[data-view]").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const view = link.dataset.view;
                if (view) switchView(view);
                // Close mobile sidebar
                document.getElementById("sidebar").classList.remove("open");
            });
        });

        // Mobile toggle
        const toggle = document.getElementById("sidebarToggle");
        if (toggle) {
            toggle.addEventListener("click", () => {
                document.getElementById("sidebar").classList.toggle("open");
            });
        }

        // Close sidebar on outside click (mobile)
        document.addEventListener("click", (e) => {
            const sidebar = document.getElementById("sidebar");
            const toggle = document.getElementById("sidebarToggle");
            if (sidebar && sidebar.classList.contains("open") &&
                !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebar.classList.remove("open");
            }
        });
    }

    function switchView(viewId) {
        UI.showView(viewId);
        const titles = { dashboard: "Tableau de bord", generate: "Générateur", recipes: "Mes Recettes", history: "Historique", settings: "Paramètres" };
        const navTitle = document.getElementById("navTitle");
        if (navTitle) navTitle.textContent = titles[viewId] || "Tableau de bord";

        // Load view-specific data
        if (viewId === "history") loadHistory();
        if (viewId === "settings") loadSettings();
        if (viewId === "recipes") renderRecipesGrid(allRecipes);
    }

    // ============================================================
    // DARK MODE
    // ============================================================
    function initDarkMode() {
        const toggle = document.getElementById("darkModeToggle");
        const sw = document.getElementById("darkModeSwitch");
        if (toggle) toggle.addEventListener("click", () => {
            UI.toggleDarkMode();
            if (sw) sw.checked = document.documentElement.getAttribute("data-theme") === "dark";
        });
        if (sw) {
            sw.checked = document.documentElement.getAttribute("data-theme") === "dark";
            sw.addEventListener("change", () => {
                UI.toggleDarkMode();
            });
        }
    }

    // ============================================================
    // DASHBOARD HOME
    // ============================================================
    function loadDashboard() {
        if (!currentUser) return;
        const greeting = document.getElementById("dashGreeting");
        if (greeting) greeting.textContent = UI.getGreeting(currentUser.displayName);
    }

    function renderDashboardStats(recipes) {
        const genEl = document.getElementById("statGenerated");
        const savedEl = document.getElementById("statSaved");
        const cuisineEl = document.getElementById("statCuisine");
        const lastEl = document.getElementById("statLast");

        if (genEl) genEl.textContent = recipes.length;
        const saved = recipes.filter(r => r.isSaved);
        if (savedEl) savedEl.textContent = saved.length;

        // Top cuisine
        const cuisineCounts = {};
        recipes.forEach(r => {
            const c = r.cuisine || "any";
            if (c !== "any") cuisineCounts[c] = (cuisineCounts[c] || 0) + 1;
        });
        const topCuisine = Object.entries(cuisineCounts).sort((a, b) => b[1] - a[1])[0];
        if (cuisineEl) cuisineEl.textContent = topCuisine ? topCuisine[0] : "—";

        // Last generated
        if (lastEl && recipes.length > 0 && recipes[0].createdAt) {
            lastEl.textContent = UI.formatDate(recipes[0].createdAt);
        }
    }

    function renderRecentRecipes(recipes) {
        const grid = document.getElementById("recentRecipesGrid");
        const empty = document.getElementById("recentEmpty");
        if (!grid) return;

        const recent = recipes.slice(0, 6);
        if (recent.length === 0) {
            grid.innerHTML = "";
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");
        grid.innerHTML = recent.map(r => UI.renderSavedCard(r)).join("");
        bindCardActions(grid);
    }

    // ============================================================
    // GENERATOR — Multi-Step Form
    // ============================================================
    function initGenerator() {
        initTagInput();

        const nextBtn = document.getElementById("genNextBtn");
        const prevBtn = document.getElementById("genPrevBtn");
        const submitBtn = document.getElementById("genSubmitBtn");

        if (nextBtn) nextBtn.addEventListener("click", () => {
            if (genStep === 1 && ingredients.length === 0) {
                UI.showToast("Veuillez ajouter au moins un ingrédient.", "warning");
                return;
            }
            goToStep(genStep + 1);
        });
        if (prevBtn) prevBtn.addEventListener("click", () => goToStep(genStep - 1));
        if (submitBtn) submitBtn.addEventListener("click", generateRecipe);
    }

    function goToStep(step) {
        genStep = Math.max(1, Math.min(3, step));
        document.querySelectorAll(".gen-step").forEach(s => s.classList.remove("active"));
        const target = document.getElementById("genStep" + genStep);
        if (target) target.classList.add("active");

        // Progress bar
        const fill = document.getElementById("stepBarFill");
        if (fill) fill.style.width = (genStep * 33.33) + "%";

        // Step labels
        document.querySelectorAll(".step-label").forEach(l => {
            const s = parseInt(l.dataset.step);
            l.classList.toggle("active", s === genStep);
            l.classList.toggle("done", s < genStep);
        });

        // Buttons
        const nextBtn = document.getElementById("genNextBtn");
        const prevBtn = document.getElementById("genPrevBtn");
        const submitBtn = document.getElementById("genSubmitBtn");
        if (prevBtn) prevBtn.style.display = genStep > 1 ? "inline-block" : "none";
        if (nextBtn) nextBtn.classList.toggle("d-none", genStep === 3);
        if (submitBtn) submitBtn.classList.toggle("d-none", genStep !== 3);

        // Populate review step
        if (genStep === 3) populateReview();
    }

    function populateReview() {
        const revIng = document.getElementById("reviewIngredients");
        const revPrefs = document.getElementById("reviewPrefs");
        if (revIng) {
            revIng.innerHTML = ingredients.map(i =>
                `<span class="tag-badge">${i}</span>`).join("");
        }
        if (revPrefs) {
            const c = document.getElementById("genCuisine").value;
            const m = document.getElementById("genMeal").value;
            const d = document.getElementById("genDiet").value;
            const diff = document.getElementById("genDifficulty").value;
            const s = document.getElementById("genServings").value;
            revPrefs.innerHTML = `
                <p class="mb-1"><strong>Cuisine:</strong> ${c} · <strong>Repas:</strong> ${m} · <strong>Régime:</strong> ${d}</p>
                <p class="mb-0"><strong>Difficulté:</strong> ${diff} · <strong>Portions:</strong> ${s}</p>`;
        }
    }

    // Tag Input
    function initTagInput() {
        const wrap = document.getElementById("tagInputWrap");
        const input = document.getElementById("tagInput");
        if (!input || !wrap) return;

        wrap.addEventListener("click", () => input.focus());

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(input.value);
                input.value = "";
            }
            if (e.key === "Backspace" && input.value === "" && ingredients.length > 0) {
                ingredients.pop();
                renderTags();
            }
        });

        input.addEventListener("blur", () => {
            if (input.value.trim()) {
                addTag(input.value);
                input.value = "";
            }
        });
    }

    function addTag(val) {
        const clean = val.replace(",", "").trim().toLowerCase();
        if (clean && !ingredients.includes(clean)) {
            ingredients.push(clean);
            renderTags();
        }
    }

    function renderTags() {
        const wrap = document.getElementById("tagInputWrap");
        const input = document.getElementById("tagInput");
        if (!wrap) return;
        // Remove old tags
        wrap.querySelectorAll(".tag-badge").forEach(t => t.remove());
        // Add tags before input
        ingredients.forEach((ing, i) => {
            const tag = document.createElement("span");
            tag.className = "tag-badge";
            tag.innerHTML = `${ing} <button class="tag-remove" data-index="${i}">&times;</button>`;
            wrap.insertBefore(tag, input);
        });
        // Bind remove
        wrap.querySelectorAll(".tag-remove").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                ingredients.splice(parseInt(btn.dataset.index), 1);
                renderTags();
            });
        });
    }

    // Generate Recipe
    async function generateRecipe() {
        const submitBtn = document.getElementById("genSubmitBtn");
        const loading = document.getElementById("genLoading");
        const result = document.getElementById("genResult");
        const error = document.getElementById("genError");

        if (!currentUser || ingredients.length === 0) return;

        // Show skeleton
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Génération…';
        if (loading) { loading.classList.remove("d-none"); loading.innerHTML = UI.renderSkeleton(); }
        if (result) result.innerHTML = "";
        if (error) error.classList.add("d-none");

        try {
            const recipe = await API.generateRecipe({
                ingredients: ingredients,
                cuisine: document.getElementById("genCuisine").value,
                mealType: document.getElementById("genMeal").value,
                dietary: document.getElementById("genDiet").value,
                difficulty: document.getElementById("genDifficulty").value,
                servings: document.getElementById("genServings").value
            });

            // Save to Firestore
            const recipeId = await DB.saveRecipe(currentUser.uid, recipe, {
                cuisine: document.getElementById("genCuisine").value,
                meal: document.getElementById("genMeal").value,
                diet: document.getElementById("genDiet").value
            });

            // Add to history
            await DB.addToHistory(currentUser.uid, recipeId, recipe.title);

            // Render result
            if (loading) loading.classList.add("d-none");
            if (result) {
                result.innerHTML = UI.renderRecipeCard(recipe, recipeId);
                bindResultActions(result, recipe, recipeId);
            }

            UI.showToast("Recette générée avec succès !", "success");

        } catch (err) {
            if (loading) loading.classList.add("d-none");
            if (error) {
                error.classList.remove("d-none");
                error.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle-fill me-2"></i>${err.message || "Un problème est survenu. Veuillez réessayer."}</div>`;
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-magic"></i> Générer';
        }
    }

    function bindResultActions(container, recipe, recipeId) {
        // Bookmark
        const bookmarkBtn = container.querySelector(".btn-bookmark");
        if (bookmarkBtn) {
            bookmarkBtn.addEventListener("click", async () => {
                const saved = bookmarkBtn.dataset.saved === "true";
                await DB.toggleBookmark(currentUser.uid, recipeId, saved);
                bookmarkBtn.dataset.saved = (!saved).toString();
                bookmarkBtn.classList.toggle("saved", !saved);
                bookmarkBtn.innerHTML = `<i class="bi ${!saved ? 'bi-bookmark-fill' : 'bi-bookmark'}"></i>`;
            });
        }
        // Start Cooking
        const cookBtn = container.querySelector(".btn-cook");
        if (cookBtn) {
            cookBtn.addEventListener("click", () => openCookingMode(recipe));
        }
    }

    // ============================================================
    // MY RECIPES VIEW
    // ============================================================
    function initRecipesView() {
        const search = document.getElementById("recipeSearch");
        const sort = document.getElementById("sortSelect");
        const chips = document.getElementById("filterChips");

        if (search) search.addEventListener("input", () => renderRecipesGrid(allRecipes));
        if (sort) sort.addEventListener("change", () => renderRecipesGrid(allRecipes));
        if (chips) chips.addEventListener("click", (e) => {
            if (e.target.classList.contains("filter-chip")) {
                chips.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
                e.target.classList.add("active");
                renderRecipesGrid(allRecipes);
            }
        });
    }

    function renderRecipesGrid(recipes) {
        const grid = document.getElementById("recipesGrid");
        const empty = document.getElementById("recipesEmpty");
        if (!grid) return;

        let filtered = [...recipes];

        // Filter
        const activeFilter = document.querySelector(".filter-chip.active");
        const filter = activeFilter ? activeFilter.dataset.filter : "all";
        if (filter === "saved") filtered = filtered.filter(r => r.isSaved);

        // Search
        const search = (document.getElementById("recipeSearch")?.value || "").toLowerCase();
        if (search) {
            filtered = filtered.filter(r => {
                const title = (r.title || "").toLowerCase();
                const ings = (r.ingredients || []).map(i => typeof i === "string" ? i : i.name || "").join(" ").toLowerCase();
                return title.includes(search) || ings.includes(search);
            });
        }

        // Sort
        const sortVal = document.getElementById("sortSelect")?.value || "newest";
        if (sortVal === "oldest") filtered.reverse();
        if (sortVal === "az") filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

        // Render
        if (filtered.length === 0) {
            grid.innerHTML = "";
            if (empty) empty.classList.remove("d-none");
        } else {
            if (empty) empty.classList.add("d-none");
            grid.innerHTML = filtered.map(r => UI.renderSavedCard(r)).join("");
            bindCardActions(grid);
        }
    }

    function bindCardActions(container) {
        // View detail
        container.querySelectorAll(".btn-view-recipe").forEach(btn => {
            btn.addEventListener("click", () => openRecipeDetail(btn.dataset.id));
        });
        // Bookmark toggle
        container.querySelectorAll(".btn-bookmark-toggle").forEach(btn => {
            btn.addEventListener("click", async () => {
                const saved = btn.dataset.saved === "true";
                await DB.toggleBookmark(currentUser.uid, btn.dataset.id, saved);
            });
        });
        // Delete
        container.querySelectorAll(".btn-delete-recipe").forEach(btn => {
            btn.addEventListener("click", () => {
                deleteTargetId = btn.dataset.id;
                const modal = new bootstrap.Modal(document.getElementById("deleteConfirmModal"));
                modal.show();
            });
        });
        // Click card to view
        container.querySelectorAll(".saved-card").forEach(card => {
            card.addEventListener("click", (e) => {
                if (e.target.closest("button")) return;
                openRecipeDetail(card.dataset.recipeId);
            });
        });
    }

    // Delete confirmation
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener("click", async () => {
            if (deleteTargetId && currentUser) {
                await DB.deleteRecipe(currentUser.uid, deleteTargetId);
                deleteTargetId = null;
                bootstrap.Modal.getInstance(document.getElementById("deleteConfirmModal"))?.hide();
            }
        });
    }

    // ============================================================
    // RECIPE DETAIL MODAL
    // ============================================================
    let detailRecipe = null;

    function openRecipeDetail(recipeId) {
        const recipe = allRecipes.find(r => r.id === recipeId);
        if (!recipe) return;
        detailRecipe = recipe;

        // Overview tab
        const overview = document.getElementById("tabOverview");
        if (overview) {
            const n = recipe.nutrition || {};
            const tagsHtml = (recipe.tags || []).map(t => `<span class="badge bg-tag">${t}</span>`).join("");
            overview.innerHTML = `
                <h4 class="fw-bold">${recipe.title || "Sans titre"}</h4>
                <p class="text-muted">${recipe.description || ""}</p>
                <div class="recipe-meta mb-3">
                    ${recipe.prepTime ? `<span class="meta-item"><i class="bi bi-clock"></i> Prépa : ${recipe.prepTime}</span>` : ""}
                    ${recipe.cookTime ? `<span class="meta-item"><i class="bi bi-fire"></i> Cuisson : ${recipe.cookTime}</span>` : ""}
                    ${recipe.difficulty ? `<span class="meta-item"><i class="bi bi-speedometer2"></i> ${recipe.difficulty}</span>` : ""}
                    ${recipe.servings ? `<span class="meta-item"><i class="bi bi-people"></i> ${recipe.servings} portions</span>` : ""}
                </div>
                <div class="tags-row">${tagsHtml}</div>
                <div class="nutrition-section">
                    ${n.calories ? `<span class="nutrition-badge nb-calories"><i class="bi bi-fire"></i> ${n.calories} cal</span>` : ""}
                    ${n.protein ? `<span class="nutrition-badge nb-protein"><i class="bi bi-droplet"></i> ${n.protein}</span>` : ""}
                    ${n.carbs ? `<span class="nutrition-badge nb-carbs"><i class="bi bi-grain"></i> ${n.carbs}</span>` : ""}
                    ${n.fat ? `<span class="nutrition-badge nb-fat"><i class="bi bi-egg-fried"></i> ${n.fat}</span>` : ""}
                </div>`;
        }

        // Ingredients tab
        const ingTab = document.getElementById("tabIngredients");
        if (ingTab) {
            const ings = (recipe.ingredients || []).map(i => {
                const name = typeof i === "string" ? i : `${i.amount || ""} ${i.unit || ""} ${i.name || ""}`.trim();
                return `<li>${name}</li>`;
            }).join("");
            ingTab.innerHTML = `<ul class="ingredient-list">${ings}</ul>`;
        }

        // Instructions tab
        const instrTab = document.getElementById("tabInstructions");
        if (instrTab) {
            const instrs = (recipe.instructions || []).map(i => {
                const text = typeof i === "string" ? i : i.text;
                return `<li>${text}</li>`;
            }).join("");
            instrTab.innerHTML = `<ol class="instruction-list">${instrs}</ol>`;
        }

        // Nutrition tab
        const nutriTab = document.getElementById("tabNutrition");
        if (nutriTab) {
            nutriTab.innerHTML = `<h5 class="fw-bold mb-4">Valeurs nutritionnelles</h5>${UI.renderNutritionBars(recipe.nutrition)}`;
        }

        new bootstrap.Modal(document.getElementById("recipeDetailModal")).show();
    }

    // Detail Cook button
    const detailCookBtn = document.getElementById("detailCookBtn");
    if (detailCookBtn) {
        detailCookBtn.addEventListener("click", () => {
            bootstrap.Modal.getInstance(document.getElementById("recipeDetailModal"))?.hide();
            if (detailRecipe) setTimeout(() => openCookingMode(detailRecipe), 300);
        });
    }

    // ============================================================
    // HISTORY VIEW
    // ============================================================
    function initHistoryView() {}

    async function loadHistory() {
        if (!currentUser) return;
        const list = document.getElementById("historyList");
        const empty = document.getElementById("historyEmpty");
        if (!list) return;

        const history = await DB.getHistory(currentUser.uid);
        if (history.length === 0) {
            list.innerHTML = "";
            if (empty) empty.classList.remove("d-none");
            return;
        }
        if (empty) empty.classList.add("d-none");

        // Group by date
        let html = "";
        let lastLabel = "";
        history.forEach(h => {
            const label = UI.getDateLabel(h.generatedAt);
            if (label !== lastLabel) {
                html += `<div class="history-group-label">${label}</div>`;
                lastLabel = label;
            }
            html += `
                <div class="history-item">
                    <div class="history-item-info">
                        <h6>${h.title || "Sans titre"}</h6>
                        <small>${h.generatedAt ? UI.formatDate(h.generatedAt) : ""}</small>
                    </div>
                    <button class="btn-reopen" data-recipe-id="${h.recipeId}"><i class="bi bi-eye"></i> Ouvrir</button>
                </div>`;
        });
        list.innerHTML = html;

        // Bind re-open
        list.querySelectorAll(".btn-reopen").forEach(btn => {
            btn.addEventListener("click", () => openRecipeDetail(btn.dataset.recipeId));
        });
    }

    // ============================================================
    // SETTINGS
    // ============================================================
    function initSettingsView() {
        const saveProfile = document.getElementById("saveProfileBtn");
        const savePrefs = document.getElementById("savePrefsBtn");
        const deleteAll = document.getElementById("deleteAllRecipesBtn");
        const deleteAcct = document.getElementById("deleteAccountBtn");

        if (saveProfile) saveProfile.addEventListener("click", async () => {
            const name = document.getElementById("settingsName").value.trim();
            if (name) await Auth.updateProfile(name);
        });

        if (savePrefs) savePrefs.addEventListener("click", async () => {
            if (!currentUser) return;
            await DB.updatePreferences(currentUser.uid, {
                cuisine: document.getElementById("prefCuisine").value,
                dietary: document.getElementById("prefDiet").value
            });
        });

        if (deleteAll) deleteAll.addEventListener("click", async () => {
            if (!currentUser) return;
            if (confirm("Êtes-vous sûr de vouloir supprimer TOUTES vos recettes ? Cette action est irréversible.")) {
                await DB.deleteAllRecipes(currentUser.uid);
            }
        });

        if (deleteAcct) deleteAcct.addEventListener("click", async () => {
            if (confirm("Êtes-vous sûr ? Cela supprimera définitivement votre compte et toutes vos données.")) {
                await Auth.deleteAccount();
            }
        });
    }

    function loadSettings() {
        if (!currentUser) return;
        const nameEl = document.getElementById("settingsName");
        const emailEl = document.getElementById("settingsEmail");
        if (nameEl) nameEl.value = currentUser.displayName || "";
        if (emailEl) emailEl.value = currentUser.email || "";
    }

    async function loadPreferences() {
        if (!currentUser) return;
        const profile = await DB.getUserProfile(currentUser.uid);
        if (profile && profile.preferences) {
            const pc = document.getElementById("prefCuisine");
            const pd = document.getElementById("prefDiet");
            const gc = document.getElementById("genCuisine");
            const gd = document.getElementById("genDiet");
            if (pc) pc.value = profile.preferences.cuisine || "any";
            if (pd) pd.value = profile.preferences.dietary || "none";
            if (gc) gc.value = profile.preferences.cuisine || "any";
            if (gd) gd.value = profile.preferences.dietary || "none";
        }
    }

    // ============================================================
    // COOKING MODE
    // ============================================================
    function initCookingMode() {
        const prevBtn = document.getElementById("cookPrevBtn");
        const nextBtn = document.getElementById("cookNextBtn");
        const doneBtn = document.getElementById("cookDoneBtn");
        const timerStart = document.getElementById("timerStartBtn");
        const timerReset = document.getElementById("timerResetBtn");

        if (prevBtn) prevBtn.addEventListener("click", () => navigateCooking(-1));
        if (nextBtn) nextBtn.addEventListener("click", () => navigateCooking(1));
        if (doneBtn) doneBtn.addEventListener("click", finishCooking);
        if (timerStart) timerStart.addEventListener("click", toggleTimer);
        if (timerReset) timerReset.addEventListener("click", resetTimer);

        // Keyboard navigation
        document.addEventListener("keydown", (e) => {
            const modal = document.getElementById("cookingModal");
            if (!modal || !modal.classList.contains("show")) return;
            if (e.key === "ArrowRight" || e.key === "ArrowDown") navigateCooking(1);
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") navigateCooking(-1);
        });
    }

    function openCookingMode(recipe) {
        cookingRecipe = recipe;
        cookingStep = 0;
        clearInterval(timerInterval);
        timerRunning = false;

        const title = document.getElementById("cookingTitle");
        if (title) title.textContent = recipe.title;

        // Ingredients checklist
        const ingList = document.getElementById("cookIngredientsList");
        if (ingList) {
            ingList.innerHTML = (recipe.ingredients || []).map((ing, i) => {
                const name = typeof ing === "string" ? ing : `${ing.amount || ""} ${ing.unit || ""} ${ing.name || ""}`.trim();
                return `<div class="form-check"><input class="form-check-input" type="checkbox" id="cookIng${i}"><label class="form-check-label" for="cookIng${i}">${name}</label></div>`;
            }).join("");
        }

        renderCookingStep();
        new bootstrap.Modal(document.getElementById("cookingModal")).show();
    }

    function navigateCooking(dir) {
        if (!cookingRecipe) return;
        const steps = cookingRecipe.instructions || [];
        const newStep = cookingStep + dir;
        if (newStep < 0 || newStep >= steps.length) return;
        cookingStep = newStep;
        clearInterval(timerInterval);
        timerRunning = false;
        renderCookingStep();
    }

    function renderCookingStep() {
        const steps = cookingRecipe.instructions || [];
        const total = steps.length;
        const current = steps[cookingStep];
        const text = typeof current === "string" ? current : current?.text || "";
        const duration = typeof current === "string" ? null : current?.duration;

        // Step indicator
        const indicator = document.getElementById("cookStepIndicator");
        if (indicator) indicator.textContent = `Étape ${cookingStep + 1} sur ${total}`;

        // Progress bar
        const bar = document.getElementById("cookProgressBar");
        if (bar) bar.style.width = ((cookingStep + 1) / total * 100) + "%";

        // Step content
        const numEl = document.getElementById("cookStepNum");
        const textEl = document.getElementById("cookStepText");
        if (numEl) numEl.textContent = cookingStep + 1;
        if (textEl) textEl.textContent = text;

        // Re-animate
        const display = document.getElementById("cookStepDisplay");
        if (display) { display.style.animation = "none"; display.offsetHeight; display.style.animation = "fadeSlideIn 0.3s ease"; }

        // Timer
        const timerWrap = document.getElementById("cookTimerWrap");
        if (duration && parseDuration(duration) > 0) {
            timerSeconds = parseDuration(duration);
            updateTimerDisplay();
            if (timerWrap) timerWrap.style.display = "flex";
        } else {
            if (timerWrap) timerWrap.style.display = "none";
        }

        // Nav buttons
        const prevBtn = document.getElementById("cookPrevBtn");
        const nextBtn = document.getElementById("cookNextBtn");
        const doneBtn = document.getElementById("cookDoneBtn");
        if (prevBtn) prevBtn.disabled = cookingStep === 0;
        if (nextBtn) nextBtn.classList.toggle("d-none", cookingStep === total - 1);
        if (doneBtn) doneBtn.classList.toggle("d-none", cookingStep !== total - 1);
    }

    function parseDuration(dur) {
        if (!dur) return 0;
        const match = dur.match(/(\d+)/);
        if (!match) return 0;
        const num = parseInt(match[1]);
        if (dur.toLowerCase().includes("hour")) return num * 3600;
        return num * 60; // default to minutes
    }

    function toggleTimer() {
        const btn = document.getElementById("timerStartBtn");
        if (timerRunning) {
            clearInterval(timerInterval);
            timerRunning = false;
            if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
        } else {
            timerRunning = true;
            if (btn) btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
            timerInterval = setInterval(() => {
                timerSeconds--;
                if (timerSeconds <= 0) {
                    clearInterval(timerInterval);
                    timerRunning = false;
                    timerSeconds = 0;
                    if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
                    UI.showToast("Minuterie terminée !", "success");
                }
                updateTimerDisplay();
            }, 1000);
        }
    }

    function resetTimer() {
        clearInterval(timerInterval);
        timerRunning = false;
        const current = cookingRecipe?.instructions?.[cookingStep];
        const duration = typeof current === "string" ? null : current?.duration;
        timerSeconds = duration ? parseDuration(duration) : 0;
        updateTimerDisplay();
        const btn = document.getElementById("timerStartBtn");
        if (btn) btn.innerHTML = '<i class="bi bi-play-fill"></i>';
    }

    function updateTimerDisplay() {
        const display = document.getElementById("timerDisplay");
        if (!display) return;
        const m = Math.floor(timerSeconds / 60);
        const s = timerSeconds % 60;
        display.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    function finishCooking() {
        clearInterval(timerInterval);
        UI.showToast("Bravo ! Recette terminée !", "success");
        bootstrap.Modal.getInstance(document.getElementById("cookingModal"))?.hide();
    }

})();

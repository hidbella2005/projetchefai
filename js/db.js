// ============================================================
// Database Module (Firestore)
// All Firestore CRUD operations for recipes, history, profile.
// ============================================================

const DB = {
    /**
     * Save a generated recipe to Firestore.
     */
    async saveRecipe(uid, recipe, meta = {}) {
        try {
            const docRef = await db.collection("users").doc(uid)
                .collection("recipes").add({
                    ...recipe,
                    cuisine: meta.cuisine || "any",
                    meal: meta.meal || "any",
                    diet: meta.diet || "none",
                    isSaved: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            // Increment counter
            await db.collection("users").doc(uid).update({
                recipesGenerated: firebase.firestore.FieldValue.increment(1)
            });
            return docRef.id;
        } catch (err) {
            UI.showToast("Failed to save recipe.", "danger");
            throw err;
        }
    },

    /**
     * Get all recipes for a user (one-time fetch).
     */
    async getRecipes(uid) {
        try {
            const snap = await db.collection("users").doc(uid)
                .collection("recipes").orderBy("createdAt", "desc").get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
            UI.showToast("Failed to load recipes.", "danger");
            return [];
        }
    },

    /**
     * Listen to recipes in real time.
     */
    listenToRecipes(uid, callback) {
        return db.collection("users").doc(uid)
            .collection("recipes")
            .orderBy("createdAt", "desc")
            .onSnapshot(snap => {
                const recipes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                callback(recipes);
            }, err => {
                console.error("Recipe listener error:", err);
            });
    },

    /**
     * Toggle the isSaved (bookmark) flag on a recipe.
     */
    async toggleBookmark(uid, recipeId, currentState) {
        try {
            await db.collection("users").doc(uid)
                .collection("recipes").doc(recipeId)
                .update({ isSaved: !currentState });
            UI.showToast(!currentState ? "Recipe saved!" : "Removed from saved.", "success");
        } catch (err) {
            UI.showToast("Failed to update bookmark.", "danger");
        }
    },

    /**
     * Delete a single recipe.
     */
    async deleteRecipe(uid, recipeId) {
        try {
            await db.collection("users").doc(uid)
                .collection("recipes").doc(recipeId).delete();
            UI.showToast("Recipe deleted.", "success");
        } catch (err) {
            UI.showToast("Failed to delete recipe.", "danger");
        }
    },

    /**
     * Add an entry to recipe history.
     */
    async addToHistory(uid, recipeId, title) {
        try {
            await db.collection("users").doc(uid)
                .collection("history").add({
                    recipeId: recipeId,
                    title: title,
                    generatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        } catch (err) {
            console.error("Failed to add history:", err);
        }
    },

    /**
     * Get full history for a user.
     */
    async getHistory(uid) {
        try {
            const snap = await db.collection("users").doc(uid)
                .collection("history").orderBy("generatedAt", "desc").get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
            UI.showToast("Failed to load history.", "danger");
            return [];
        }
    },

    /**
     * Get a single recipe by ID.
     */
    async getRecipe(uid, recipeId) {
        try {
            const doc = await db.collection("users").doc(uid)
                .collection("recipes").doc(recipeId).get();
            if (!doc.exists) return null;
            return { id: doc.id, ...doc.data() };
        } catch (err) {
            UI.showToast("Failed to load recipe.", "danger");
            return null;
        }
    },

    /**
     * Get user profile and stats.
     */
    async getUserProfile(uid) {
        try {
            const doc = await db.collection("users").doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (err) {
            return null;
        }
    },

    /**
     * Update user preferences.
     */
    async updatePreferences(uid, prefs) {
        try {
            await db.collection("users").doc(uid).update({
                preferences: prefs
            });
            UI.showToast("Preferences saved!", "success");
        } catch (err) {
            UI.showToast("Failed to save preferences.", "danger");
        }
    },

    /**
     * Delete all recipes for a user.
     */
    async deleteAllRecipes(uid) {
        try {
            const snap = await db.collection("users").doc(uid)
                .collection("recipes").get();
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            const histSnap = await db.collection("users").doc(uid)
                .collection("history").get();
            const batch2 = db.batch();
            histSnap.docs.forEach(doc => batch2.delete(doc.ref));
            await batch2.commit();

            await db.collection("users").doc(uid).update({ recipesGenerated: 0 });
            UI.showToast("All recipes deleted.", "success");
        } catch (err) {
            UI.showToast("Failed to delete recipes.", "danger");
        }
    },

    /**
     * Delete all user data (called before account deletion).
     */
    async deleteAllUserData(uid) {
        try {
            await DB.deleteAllRecipes(uid);
            await db.collection("users").doc(uid).delete();
        } catch (err) {
            console.error("Failed to delete user data:", err);
        }
    }
};

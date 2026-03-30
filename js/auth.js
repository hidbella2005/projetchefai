// ============================================================
// Authentication Module
// Handles all Firebase Auth operations with toast feedback.
// ============================================================

const Auth = {
    /** Current user reference (set by onAuthStateChanged in app.js) */
    currentUser: null,

    /**
     * Register a new user with email/password, then set displayName.
     */
    async register(name, email, password) {
        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await cred.user.updateProfile({ displayName: name });
            // Create user profile doc in Firestore
            await db.collection("users").doc(cred.user.uid).set({
                name: name,
                email: email,
                avatar: "",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                recipesGenerated: 0,
                preferences: { cuisine: "any", dietary: "none" }
            });
            UI.showToast("Compte créé avec succès !", "success");
            window.location.href = "dashboard.html";
        } catch (err) {
            UI.showToast(Auth._friendlyError(err.code), "danger");
            throw err;
        }
    },

    /**
     * Log in with email and password.
     */
    async login(email, password) {
        try {
            await auth.signInWithEmailAndPassword(email, password);
            UI.showToast("Bon retour !", "success");
            window.location.href = "dashboard.html";
        } catch (err) {
            UI.showToast(Auth._friendlyError(err.code), "danger");
            throw err;
        }
    },

    /**
     * Sign in with Google popup.
     */
    async googleSignIn() {
        try {
            const result = await auth.signInWithPopup(googleProvider);
            // If new user, create Firestore profile
            if (result.additionalUserInfo && result.additionalUserInfo.isNewUser) {
                await db.collection("users").doc(result.user.uid).set({
                    name: result.user.displayName || "Utilisateur",
                    email: result.user.email,
                    avatar: result.user.photoURL || "",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    recipesGenerated: 0,
                    preferences: { cuisine: "any", dietary: "none" }
                });
            }
            UI.showToast("Connecté avec Google !", "success");
            window.location.href = "dashboard.html";
        } catch (err) {
            if (err.code !== "auth/popup-closed-by-user") {
                UI.showToast(Auth._friendlyError(err.code), "danger");
            }
            throw err;
        }
    },

    /**
     * Log out the current user.
     */
    async logout() {
        try {
            await auth.signOut();
            window.location.href = "index.html";
        } catch (err) {
            UI.showToast("Échec de la déconnexion.", "danger");
        }
    },

    /**
     * Update user display name.
     */
    async updateProfile(name) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Non connecté");
            await user.updateProfile({ displayName: name });
            await db.collection("users").doc(user.uid).update({ name: name });
            UI.showToast("Profil mis à jour !", "success");
        } catch (err) {
            UI.showToast("Échec de la mise à jour du profil.", "danger");
            throw err;
        }
    },

    /**
     * Delete the user's account and all their data.
     */
    async deleteAccount() {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Non connecté");
            // Delete user data from Firestore first
            await DB.deleteAllUserData(user.uid);
            await user.delete();
            UI.showToast("Compte supprimé.", "success");
            window.location.href = "index.html";
        } catch (err) {
            if (err.code === "auth/requires-recent-login") {
                UI.showToast("Veuillez vous déconnecter et vous reconnecter avant de supprimer votre compte.", "warning");
            } else {
                UI.showToast("Échec de la suppression du compte.", "danger");
            }
            throw err;
        }
    },

    /**
     * Convert Firebase error codes to user-friendly messages.
     */
    _friendlyError(code) {
        const map = {
            "auth/email-already-in-use": "Cet e-mail est déjà enregistré.",
            "auth/invalid-email": "Veuillez entrer une adresse e-mail valide.",
            "auth/weak-password": "Le mot de passe doit comporter au moins 6 caractères.",
            "auth/user-not-found": "Aucun compte trouvé avec cet e-mail.",
            "auth/wrong-password": "Mot de passe incorrect.",
            "auth/too-many-requests": "Trop de tentatives. Veuillez réessayer plus tard.",
            "auth/network-request-failed": "Erreur réseau. Vérifiez votre connexion.",
            "auth/invalid-credential": "E-mail ou mot de passe invalide."
        };
        return map[code] || `Erreur d'authentification : ${code}`;
    }
};

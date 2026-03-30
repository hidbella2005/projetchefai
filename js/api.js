// ============================================================
// Groq API Integration (api.js)
// Generates recipes using Llama 3.3 70B via Groq (Free Tier)
// Get your free API key at: https://console.groq.com/keys
// ============================================================

const API = {
    // 🔑 Paste your free Groq API key here.
    // Get it at: https://console.groq.com/keys (free, no billing required)
    GROQ_KEY: "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",
    MODEL: "llama-3.3-70b-versatile",

    async generateRecipe(prefs) {
        if (!this.GROQ_KEY || this.GROQ_KEY === "YOUR_GROQ_API_KEY") {
            throw new Error("Clé API Groq manquante. Obtenez-en une gratuitement sur console.groq.com/keys et ajoutez-la dans js/api.js");
        }

        const ingredientsStr = prefs.ingredients.join(", ");

        const prompt = `Tu es un grand chef cuisinier créatif. Crée une recette originale EN FRANÇAIS en utilisant ces ingrédients : ${ingredientsStr}.

Préférences :
- Cuisine : ${prefs.cuisine}
- Type de repas : ${prefs.mealType}
- Régime alimentaire : ${prefs.dietary}
- Difficulté : ${prefs.difficulty}
- Nombre de portions : ${prefs.servings}

IMPORTANT : Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après, sans bloc de code markdown, avec EXACTEMENT cette structure :
{
  "title": "Nom de la recette",
  "description": "Description courte et appétissante",
  "prepTime": "XX mins",
  "cookTime": "XX mins",
  "ingredients": ["quantité + ingrédient"],
  "instructions": [
    { "text": "Instruction détaillée étape par étape", "duration": "X mins" }
  ],
  "nutrition": {
    "calories": 000,
    "protein": "XXg",
    "carbs": "XXg",
    "fat": "XXg"
  }
}

Assure-toi que :
- La recette est réaliste et savoureuse
- Les quantités sont précises
- Les instructions sont claires et détaillées
- Les valeurs nutritionnelles sont approximativement correctes
- Le champ "duration" dans les instructions est optionnel (utilise-le seulement pour les étapes avec un temps d'attente/cuisson)
- Tu retournes UNIQUEMENT le JSON, rien d'autre`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.GROQ_KEY}`
            },
            body: JSON.stringify({
                model: this.MODEL,
                messages: [
                    {
                        role: "system",
                        content: "Tu es un chef cuisinier expert. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte supplémentaire, sans bloc de code markdown."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2048,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || response.statusText;

            if (response.status === 401) {
                throw new Error("Clé API invalide. Vérifiez votre clé Groq dans js/api.js");
            }
            if (response.status === 429) {
                throw new Error("Limite de requêtes atteinte. Veuillez réessayer dans quelques secondes.");
            }
            throw new Error(`Erreur API (${response.status}): ${errMsg}`);
        }

        const data = await response.json();

        try {
            const text = data.choices[0].message.content;

            let jsonStr = text.trim();

            // If wrapped in markdown code blocks, extract the JSON
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) {
                jsonStr = codeBlockMatch[1].trim();
            }

            // If JSON is not starting with {, try to find it
            if (!jsonStr.startsWith("{")) {
                const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                if (jsonMatch) jsonStr = jsonMatch[0];
            }

            const recipe = JSON.parse(jsonStr);

            // Validate required fields
            if (!recipe.title || !recipe.ingredients || !recipe.instructions) {
                throw new Error("Format de recette incomplet");
            }

            return recipe;
        } catch (e) {
            console.error("Échec du parsing JSON de la recette:", data);
            throw new Error("L'IA a généré un format invalide. Veuillez réessayer.");
        }
    }
};

# 🚀 Instructions de Déploiement - Backend Gratuit

## Option choisie: **Backend Express + Render.com = 0€**

Vous payez uniquement Mistral AI (~10€/mois), pas Firebase.

---

## Étape 1: Déployer le Backend sur Render (5 minutes)

### A. Créer un compte Render.com
1. Allez sur https://render.com
2. Cliquez "Get Started" et créez un compte (GitHub recommandé)

### B. Créer un dépôt GitHub pour le backend
```bash
cd mistral-backend
git init
git add .
git commit -m "Backend Mistral AI pour EtudEasy"
```

Créez un nouveau repo sur GitHub et pushez:
```bash
git remote add origin https://github.com/VOTRE_USERNAME/etudeasy-mistral-backend.git
git branch -M main
git push -u origin main
```

### C. Déployer sur Render
1. Sur Render Dashboard, cliquez **"New +"** → **"Web Service"**
2. Connectez votre compte GitHub
3. Sélectionnez le repo `etudeasy-mistral-backend`
4. Render détecte automatiquement le fichier `render.yaml`
5. Dans "Environment Variables", ajoutez:
   - **MISTRAL_API_KEY** = `jZc3qUdMqDpmqsyWBSO1mXUVvL09hZ2l`
6. Cliquez **"Create Web Service"**

Le déploiement prend 2-3 minutes.

### D. Récupérer l'URL
Render vous donne une URL comme:
```
https://etudeasy-mistral-backend.onrender.com
```

**Copiez cette URL !** Vous en aurez besoin à l'étape 2.

---

## Étape 2: Modifier l'App React Native (2 minutes)

Modifiez le fichier `/services/mistralChatService.ts`:

### Trouvez cette ligne (ligne ~70):
```typescript
const chatWithMistral = httpsCallable<{ messages: ChatMessage[] }, ChatResponse>(
  functions,
  'chatWithMistral'
);
```

### Remplacez toute la fonction `sendMessage` par:
```typescript
export async function sendMessage(userId: string, userMessage: string): Promise<ChatResponse> {
  try {
    // URL de votre backend Render
    const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com'; // ← VOTRE URL ICI

    // Ajouter le message utilisateur à l'historique
    const userChatMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
    };
    addToHistory(userId, userChatMessage);

    // Récupérer l'historique complet
    const history = getConversationHistory(userId);

    // Récupérer le token Firebase
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Non authentifié');
    }

    console.log('[MistralChat] Appel backend Express');

    // Appeler le backend Express
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ messages: history }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur serveur');
    }

    const data: ChatResponse = await response.json();

    if (data.success) {
      // Ajouter la réponse de l'IA à l'historique
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
      };
      addToHistory(userId, assistantMessage);

      console.log('[MistralChat] Réponse reçue de Mistral AI');
      return data;
    } else {
      // Erreur côté serveur, tenter le fallback
      console.warn('[MistralChat] Erreur serveur, tentative fallback');
      return await fallbackToLocalParser(userId, userMessage);
    }
  } catch (error: any) {
    console.error('[MistralChat] Erreur:', error);

    // Gérer les erreurs spécifiques
    if (error.message.includes('429')) {
      return {
        message: '⚠️ Limite quotidienne atteinte (50/jour). Réessaie demain.',
        success: false,
        error: error.message,
      };
    }

    // Fallback
    console.log('[MistralChat] Tentative de fallback vers parser local');
    return await fallbackToLocalParser(userId, userMessage);
  }
}
```

**N'oubliez pas de remplacer l'URL par la vôtre !**

---

## Étape 3: Ajouter l'import auth (si manquant)

En haut du fichier `mistralChatService.ts`, ajoutez:
```typescript
import { auth } from '@/config/firebase';
```

---

## Étape 4: Tester ! 🎉

```bash
npm start
```

Ouvrez le chatbot et testez:
```
"J'ai un cours de maths demain à 10h"
```

---

## ✅ C'est Terminé !

Vous avez maintenant:
- ✅ Backend Express gratuit sur Render.com (0€)
- ✅ Mistral AI actif (~10€/mois)
- ✅ Pas de coût Firebase

**Coût total: 10-15€/mois** (uniquement Mistral AI)

---

## 📊 Monitoring

### Render Dashboard
https://dashboard.render.com/

### Mistral Dashboard
https://console.mistral.ai/usage

---

## 🐛 Note Importante: Cold Start

Le plan gratuit de Render met le serveur en veille après 15min d'inactivité.

**Premier appel:** 30-60 secondes (réveil du serveur)
**Appels suivants:** < 1 seconde

C'est normal, c'est le compromis du plan gratuit.

---

## 💡 Besoin d'Aide ?

Consultez `mistral-backend/README.md` pour plus de détails.

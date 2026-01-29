# Backend Express Mistral AI - EtudEasy

Backend Node.js/Express gratuit pour Mistral AI (alternative à Firebase Functions).

## 🚀 Déploiement sur Render.com (Gratuit)

### 1. Créer un compte Render
Allez sur [render.com](https://render.com) et créez un compte gratuit.

### 2. Déployer depuis GitHub
1. Créez un nouveau dépôt GitHub pour ce backend
2. Pushez le code:
   ```bash
   cd mistral-backend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <votre-repo-github>
   git push -u origin main
   ```

3. Sur Render.com:
   - Cliquez "New Web Service"
   - Connectez votre repo GitHub
   - Render détectera automatiquement `render.yaml`
   - Ajoutez la variable d'environnement `MISTRAL_API_KEY`
   - Cliquez "Create Web Service"

### 3. URL du Backend
Render vous donnera une URL comme:
```
https://etudeasy-mistral-backend.onrender.com
```

Copiez cette URL, vous en aurez besoin dans l'app React Native.

## 💻 Test en Local

### Installation
```bash
npm install
```

### Configuration
Créez un fichier `.env` (déjà fait):
```env
MISTRAL_API_KEY=votre_clé
FIREBASE_PROJECT_ID=etudeasy-d8dc7
PORT=3000
```

### Démarrage
```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

### Test
```bash
curl http://localhost:3000/health
```

## 📡 Endpoints

### GET /health
Health check du serveur
```bash
curl https://votre-url.onrender.com/health
```

### POST /chat
Discuter avec Mistral AI
```bash
curl -X POST https://votre-url.onrender.com/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN" \
  -d '{
    "messages": [
      {"role": "user", "content": "J'\''ai un cours de maths demain à 10h"}
    ]
  }'
```

## 💰 Coûts

### Render.com (Plan Free)
- ✅ **0€/mois**
- 750 heures/mois gratuites (suffisant)
- Sleep après 15min d'inactivité (redémarre au 1er appel)

### Mistral AI
- ~10-15€/mois selon usage

**Total: 10-15€/mois** (uniquement Mistral AI)

## 🔧 Configuration App React Native

Modifiez `/services/mistralChatService.ts`:

```typescript
// Remplacer l'URL Firebase Functions par votre URL Render
const BACKEND_URL = 'https://etudeasy-mistral-backend.onrender.com';

export async function sendMessage(userId: string, userMessage: string) {
  const token = await auth.currentUser?.getIdToken();

  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messages: [...] }),
  });

  return await response.json();
}
```

## 📊 Monitoring

### Render Dashboard
- Logs en temps réel
- Métriques de performance
- Redéploiement automatique sur push GitHub

### Mistral Dashboard
- Usage API: https://console.mistral.ai/usage
- Coûts en temps réel

## 🐛 Troubleshooting

### Serveur Sleep (Render Free)
Le service s'endort après 15min d'inactivité. Le 1er appel peut prendre 30-60s.

**Solution:** Pinger le endpoint `/health` toutes les 10 minutes.

### Erreur CORS
Si vous avez des erreurs CORS, vérifiez que l'URL dans l'app correspond exactement à l'URL Render.

### Token Firebase Invalide
Assurez-vous que le token Firebase est bien envoyé dans le header `Authorization`.

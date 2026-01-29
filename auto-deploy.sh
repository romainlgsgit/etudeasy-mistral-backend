#!/bin/bash

# Script de déploiement automatique complet
# EtudEasy Mistral AI Backend

set -e

echo "🚀 Déploiement automatique - Backend Mistral AI"
echo "================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
GITHUB_REPO_NAME="etudeasy-mistral-backend"
BACKEND_DIR="mistral-backend"

echo -e "${BLUE}Étape 1/6:${NC} Vérification des dépendances..."

# Vérifier git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git non installé${NC}"
    exit 1
fi

# Vérifier gh CLI (optionnel mais recommandé)
if command -v gh &> /dev/null; then
    HAS_GH_CLI=true
    echo -e "${GREEN}✅ GitHub CLI détecté${NC}"
else
    HAS_GH_CLI=false
    echo -e "${YELLOW}⚠️  GitHub CLI non installé (optionnel)${NC}"
fi

echo ""
echo -e "${BLUE}Étape 2/6:${NC} Initialisation du dépôt Git..."
cd "$BACKEND_DIR"

if [ -d ".git" ]; then
    echo -e "${YELLOW}⚠️  Dépôt Git déjà initialisé${NC}"
else
    git init
    echo -e "${GREEN}✅ Dépôt Git initialisé${NC}"
fi

echo ""
echo -e "${BLUE}Étape 3/6:${NC} Ajout des fichiers au commit..."
git add .
git commit -m "Initial commit - Backend Mistral AI pour EtudEasy" 2>/dev/null || echo -e "${YELLOW}⚠️  Déjà commité${NC}"
echo -e "${GREEN}✅ Fichiers commités${NC}"

echo ""
echo -e "${BLUE}Étape 4/6:${NC} Création du dépôt GitHub..."

if [ "$HAS_GH_CLI" = true ]; then
    # Vérifier si connecté
    if gh auth status &> /dev/null; then
        echo "Création du repo GitHub avec gh CLI..."

        # Créer le repo (public pour plan gratuit Render)
        gh repo create "$GITHUB_REPO_NAME" --public --source=. --remote=origin --push || {
            echo -e "${YELLOW}⚠️  Le repo existe peut-être déjà${NC}"
            echo "Ajout de la remote..."
            git remote add origin "https://github.com/$(gh api user -q .login)/$GITHUB_REPO_NAME.git" 2>/dev/null || true
            git branch -M main
            git push -u origin main
        }

        GITHUB_USER=$(gh api user -q .login)
        REPO_URL="https://github.com/$GITHUB_USER/$GITHUB_REPO_NAME"
        echo -e "${GREEN}✅ Repo GitHub créé: $REPO_URL${NC}"

    else
        echo -e "${YELLOW}⚠️  GitHub CLI non authentifié${NC}"
        echo "Connexion à GitHub..."
        gh auth login

        # Réessayer après connexion
        gh repo create "$GITHUB_REPO_NAME" --public --source=. --remote=origin --push
        GITHUB_USER=$(gh api user -q .login)
        REPO_URL="https://github.com/$GITHUB_USER/$GITHUB_REPO_NAME"
        echo -e "${GREEN}✅ Repo GitHub créé: $REPO_URL${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  GitHub CLI non disponible - Étape manuelle requise${NC}"
    echo ""
    echo "📝 Instructions manuelles:"
    echo "1. Allez sur https://github.com/new"
    echo "2. Nom du repo: $GITHUB_REPO_NAME"
    echo "3. Public ✓"
    echo "4. Cliquez 'Create repository'"
    echo ""
    echo "Puis exécutez:"
    echo "  git remote add origin https://github.com/VOTRE_USERNAME/$GITHUB_REPO_NAME.git"
    echo "  git branch -M main"
    echo "  git push -u origin main"
    echo ""
    read -p "Appuyez sur Entrée une fois le repo créé et poussé..."

    # Essayer de deviner l'URL
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [ -z "$REMOTE_URL" ]; then
        read -p "Entrez l'URL de votre repo GitHub: " REPO_URL
    else
        REPO_URL=$REMOTE_URL
    fi
fi

echo ""
echo -e "${BLUE}Étape 5/6:${NC} Configuration Render.com..."
echo ""
echo -e "${YELLOW}⚠️  Étape manuelle requise (2 minutes)${NC}"
echo ""
echo "📋 Instructions Render.com:"
echo "1. Allez sur: ${BLUE}https://dashboard.render.com/create?type=web${NC}"
echo "2. Connectez votre compte GitHub (si ce n'est pas déjà fait)"
echo "3. Sélectionnez le repo: $GITHUB_REPO_NAME"
echo "4. Render détectera automatiquement render.yaml"
echo "5. Ajoutez la variable d'environnement:"
echo "   ${GREEN}MISTRAL_API_KEY${NC} = ${GREEN}jZc3qUdMqDpmqsyWBSO1mXUVvL09hZ2l${NC}"
echo "6. Cliquez '${GREEN}Create Web Service${NC}'"
echo ""
echo "⏳ Le déploiement prend 2-3 minutes..."
echo ""

# Ouvrir le navigateur automatiquement
if command -v open &> /dev/null; then
    echo "Ouverture du navigateur..."
    sleep 2
    open "https://dashboard.render.com/create?type=web"
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://dashboard.render.com/create?type=web"
fi

read -p "Appuyez sur Entrée une fois le déploiement terminé..."

echo ""
read -p "Entrez l'URL de votre service Render (ex: https://etudeasy-mistral-backend.onrender.com): " RENDER_URL

echo ""
echo -e "${BLUE}Étape 6/6:${NC} Configuration de l'app React Native..."

# Créer un fichier de config avec l'URL
cat > ../config/mistral-backend.ts << EOF
/**
 * Configuration du backend Mistral AI
 * Généré automatiquement par auto-deploy.sh
 */

export const MISTRAL_BACKEND_URL = '${RENDER_URL}';
EOF

echo -e "${GREEN}✅ Fichier de config créé: config/mistral-backend.ts${NC}"

# Créer un patch pour mistralChatService.ts
cat > ../mistralChatService.PATCH.md << 'PATCH'
# Patch à appliquer sur services/mistralChatService.ts

## En haut du fichier, ajoutez:
```typescript
import { MISTRAL_BACKEND_URL } from '@/config/mistral-backend';
import { auth } from '@/config/firebase';
```

## Remplacez la fonction sendMessage (ligne ~70) par:
```typescript
export async function sendMessage(userId: string, userMessage: string): Promise<ChatResponse> {
  try {
    const userChatMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
    };
    addToHistory(userId, userChatMessage);

    const history = getConversationHistory(userId);
    const token = await auth.currentUser?.getIdToken();

    if (!token) {
      throw new Error('Non authentifié');
    }

    console.log('[MistralChat] Appel backend Express');

    const response = await fetch(`${MISTRAL_BACKEND_URL}/chat`, {
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
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
      };
      addToHistory(userId, assistantMessage);
      return data;
    } else {
      return await fallbackToLocalParser(userId, userMessage);
    }
  } catch (error: any) {
    console.error('[MistralChat] Erreur:', error);
    return await fallbackToLocalParser(userId, userMessage);
  }
}
```
PATCH

echo -e "${GREEN}✅ Fichier de patch créé: mistralChatService.PATCH.md${NC}"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Déploiement terminé avec succès !${NC}"
echo "=========================================="
echo ""
echo "📋 Récapitulatif:"
echo "  • Repo GitHub: ${REPO_URL:-https://github.com/VOTRE_USERNAME/$GITHUB_REPO_NAME}"
echo "  • Backend URL: $RENDER_URL"
echo "  • Config créée: config/mistral-backend.ts"
echo ""
echo "📝 Dernière étape:"
echo "  Appliquez le patch dans services/mistralChatService.ts"
echo "  (voir mistralChatService.PATCH.md)"
echo ""
echo "🧪 Test:"
echo "  npm start"
echo "  → Ouvrir le chatbot"
echo "  → Tester: 'J'ai un cours de maths demain à 10h'"
echo ""
echo "💰 Coûts: 10-15€/mois (uniquement Mistral AI)"
echo ""
echo "🎉 Votre assistant IA est prêt !"
PATCH

chmod +x auto-deploy.sh
echo -e "${GREEN}✅ Script créé et rendu exécutable${NC}"

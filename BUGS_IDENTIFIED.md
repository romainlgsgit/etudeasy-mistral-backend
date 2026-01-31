# 🐛 Bugs Critiques Identifiés - Chatbot EtudEasy

Date: 31 janvier 2026

## Bug #1: Mapping Jour → Date Incorrect

**Symptômes:**
- User: "Place moi une révision d'histoire pour jeudi prochain"
- Résultat: Événement placé SAMEDI au lieu de JEUDI

**Cause:**
L'IA Mistral ne suit pas toujours les instructions du prompt système pour convertir les jours en dates YYYY-MM-DD. Elle calcule parfois mal le `targetDate` dans `auto_place_event`.

**Fichiers concernés:**
- `src/services/mistral.ts` (lignes 502-513) : Prompt système
- `src/services/tools.ts` (lignes 772-796) : Filtrage par targetDate

---

## Bug #2: Préférences Utilisateur Ignorées

**Symptômes:**
- IA propose: "Dimanche 13h-14h30 ou Samedi 13h-13h30"
- User répond: "Je préfère plutôt mercredi"
- Résultat: Événement placé VENDREDI (ni dimanche, ni mercredi!)

**Cause:**
L'IA ne parse pas le message de l'utilisateur quand il exprime une préférence de jour dans un message de suivi. Elle utilise `auto_place_event` sans tenir compte du contexte conversationnel.

**Fichiers concernés:**
- `src/services/tools.ts` : Pas de parsing du message utilisateur
- `src/services/mistral.ts` : Prompt système insuffisant pour gérer ce cas

---

## Bug #3: Validation targetDate Manquante

**Symptômes:**
- L'IA peut fournir n'importe quelle valeur de `targetDate`
- Aucune validation côté backend pour vérifier la cohérence

**Cause:**
Le backend accepte aveuglément la valeur `preferences.targetDate` fournie par l'IA sans vérifier si elle correspond au jour mentionné par l'utilisateur.

**Fichiers concernés:**
- `src/services/tools.ts` (ligne 726+) : Aucune validation dans `auto_place_event`

---

## Solutions Proposées

### Solution 1: Parser Intelligent Côté Backend
Créer un service `dateParser.ts` qui:
- Parse le message utilisateur pour extraire les jours mentionnés
- Calcule automatiquement la targetDate correcte
- Valide et corrige la targetDate fournie par l'IA

### Solution 2: Amélioration du Prompt Système
- Rendre le mapping jour→date encore plus explicite
- Ajouter des exemples concrets avec la date du jour
- Forcer l'IA à vérifier sa targetDate avant de l'envoyer

### Solution 3: Fallback Robuste
Si targetDate est incorrect ou manquant:
- Chercher dans le message utilisateur les mots-clés de jours
- Calculer la date en fonction du contexte
- Loguer un warning pour traçabilité

---

## Priorité

🔴 **CRITIQUE** - Ces bugs cassent la fonctionnalité principale du chatbot

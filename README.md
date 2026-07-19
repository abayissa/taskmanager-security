# TaskManager — Application vulnérable et sécurisée

Application de gestion de tâches développée dans le cadre d'un TP de sécurité web. Le dépôt contient une version volontairement vulnérable (branche `vulnerable`) et une version corrigée (branche `secure`).

Le rapport d'audit complet des vulnérabilités se trouve dans [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).

## Stack technique

- Frontend : React (Vite)
- Backend : Node.js / Express
- Base de données : SQLite
- Authentification : JWT

## Installation

### Backend

```bash
cd backend
npm install
```

Sur la branche `secure`, créer un fichier `.env` à la racine de `backend/` :
```
JWT_SECRET=votre_secret_ici
```

### Frontend

```bash
cd frontend
npm install
```

## Lancement

Deux terminaux séparés sont nécessaires.

**Terminal 1 — Backend**
```bash
cd backend
node server.js
```
Disponible sur `http://localhost:3000`.

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```
Disponible sur `http://localhost:5173`.

## Comptes de test

Aucun compte n'est préconfiguré. Un compte peut être créé librement via le formulaire d'inscription de l'application.

Exemple de comptes utilisés lors de l'audit :

| Utilisateur | Email | Mot de passe |
|---|---|---|
| alice | alice@test.com | 1234 |
| bob | bob@test.com | 1234 |

## Branches du dépôt

| Branche | Contenu |
|---|---|
| `main` | Version de référence du projet |
| `vulnerable` | Version contenant volontairement 6 vulnérabilités exploitables |
| `secure` | Version corrigée avec commits explicites par correction |

## Documentation

Pour le détail complet de chaque vulnérabilité (cause, exploitation, preuve, impact, criticité, correction, validation), voir [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).
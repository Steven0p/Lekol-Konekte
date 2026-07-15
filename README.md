# Lekòl Konekte

Plateforme de gestion scolaire — inscriptions, notes, bulletins et publications de documents officiels.

## Stack technique

- **Frontend** : React + Vite
- **Backend** : Node.js + Express (API REST, ES modules)
- **Base de données** : MySQL

## Structure du projet

```
backend/     API Express + accès MySQL (schéma et migrations dans backend/db)
frontend/    Application React (Vite)
docs/        Documentation
Dockerfile   Déploiement mono-service
```

## Démarrage local

### Prérequis
- Node.js 18+
- MySQL (démarré manuellement)

### Backend
```bash
cd backend
cp .env.example .env      # renseigner les identifiants MySQL
npm install
npm run seed              # données initiales (optionnel)
npm run dev               # démarre l'API
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # démarre Vite
```

## Configuration

Les identifiants (base de données, secrets) se placent dans `backend/.env`,
qui n'est **pas** versionné. Se référer à `backend/.env.example` et
`frontend/.env.example` pour la liste des variables attendues.

## Déploiement

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md).

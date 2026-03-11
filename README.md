# Gestion Réservations — Frontend Angular 17

Application Angular 17 standalone complète pour la gestion des réservations.

## 🚀 Installation

```bash
npm install
ng serve
```
Frontend: http://localhost:4200
Backend attendu: http://localhost:8080

## 👤 Comptes par défaut

| Rôle        | Email                   | Mot de passe |
|-------------|-------------------------|--------------|
| Super Admin | superadmin@app.com      | admin123     |

## 📦 Structure

```
src/app/
├── core/
│   ├── models/           # Interfaces TypeScript (DTOs)
│   ├── services/         # AuthService, ApiService, ToastService
│   ├── guards/           # authGuard, roleGuard
│   └── interceptors/     # authInterceptor (JWT)
├── shared/
│   └── components/       # Sidebar, Navbar, Toast
└── features/
    ├── auth/             # Login, Signup
    ├── super-admin/      # Secteurs, Entreprises, Gérants
    ├── gerant/           # Employés, Services, Clients, Réservations,
    │                     # Disponibilités, File d'attente, Avis
    ├── employe/          # Ma file, Réservations, Clients, Avis
    └── client/           # Réservations, Services, Créneaux, Avis
```

## 🎨 Design
- **Dark theme** : bg #0d1117 + accent amber #f0a500
- **Fonts** : Syne (display) + DM Sans (body)
- **Icons** : Font Awesome 6

## 🔑 Routing par rôle
- `/auth/login` → page de connexion
- `/super-admin/*` → ROLE_SUPER_ADMIN
- `/gerant/*` → ROLE_GERANT  
- `/employe/*` → ROLE_EMPLOYE
- `/client/*` → ROLE_CLIENT

# Rapport d'audit sécurité — TaskManager

## 1. Présentation du projet

TaskManager est une application web de gestion de tâches collaboratives. Les utilisateurs peuvent s'inscrire, se connecter, créer des tâches personnelles, les consulter et les rechercher. L'application a été développée dans le cadre d'un TP de sécurité web, avec pour objectif de concevoir volontairement une version vulnérable, puis de produire une version corrigée et sécurisée du même projet.

Le dépôt Git contient deux branches distinctes :

- `vulnerable` : version contenant volontairement 6 vulnérabilités exploitables.
- `secure` : version corrigée intégrant les remédiations pour chacune de ces failles.

## 2. Architecture de l'application

| Composant | Technologie |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js / Express |
| Base de données | SQLite |
| Authentification | JWT (JSON Web Token) |

**Schéma général**

```
Utilisateur
   │
   ▼
Frontend React (localhost:5173)
   │  requêtes HTTP (fetch)
   ▼
Backend Express (localhost:3000)
   │
   ├── /auth   → inscription, connexion
   └── /tasks  → CRUD des tâches
   │
   ▼
Base SQLite (database.sqlite)
```

**Entités principales**

- `users` : id, username, email, password (hashé avec bcrypt), role (`user` / `admin`)
- `tasks` : id, title, description, status, ownerId, sharedWith

## 3. Installation et lancement

### Prérequis
- Node.js installé
- npm installé

### Backend

```bash
cd backend
npm install
node server.js
```
Le serveur démarre sur `http://localhost:3000`.

Sur la branche `secure`, créer un fichier `.env` à la racine de `backend/` :
```
JWT_SECRET=x7K9mP2vQ8wZ4nR6tY1uL5jH3fD0sA9bC7eG2iM4oN
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```
L'application démarre sur `http://localhost:5173`.

### Comptes de test

Aucun compte n'est préconfiguré. Un compte peut être créé librement via le formulaire d'inscription de l'application. Exemple utilisé pour cet audit :

| Utilisateur | Email | Mot de passe |
|---|---|---|
| alice | alice@test.com | 1234 |
| bob | bob@test.com | 1234 |

## 4. Organisation Git

Le dépôt contient trois branches :

- `main` : point de départ / version de référence du projet
- `vulnerable` : version contenant les 6 failles volontaires
- `secure` : version corrigée, avec commits explicites par correction

**Exemples de commits réalisés**

```
feat: backend vulnerable avec 5 failles (JWT, IDOR, SQLi, XSS, mass assignment)
fix: correction structure dossier routes
fix: correction mass assignment et JWT faible (auth.js)
fix: correction IDOR et injection SQL (tasks.js)
fix: correction XSS stocké (tasks.js)
fix: correction security misconfiguration (server.js)
feat: ajout frontend React
```

## 5. Liste des vulnérabilités intégrées

| ID | Nom | Type OWASP |
|---|---|---|
| VULN-01 | Broken Access Control / IDOR | Broken Access Control |
| VULN-02 | Injection SQL | Injection |
| VULN-03 | XSS stocké | Cross-Site Scripting |
| VULN-04 | Mass Assignment | Mass Assignment |
| VULN-05 | Authentification faible (JWT) | Authentification faible |
| VULN-06 | Security Misconfiguration / Information Disclosure | Security Misconfiguration |

## 6. Audit détaillé des vulnérabilités

---

### VULN-01 — Broken Access Control / IDOR

**Type**
Broken Access Control / IDOR / BOLA

**Endpoint concerné**
`GET /tasks/:id`

**Description**
Cet endpoint permet à un utilisateur authentifié de consulter une tâche à partir de son identifiant. Le backend ne vérifie pas que la tâche appartient bien à l'utilisateur connecté avant de la renvoyer.

**Cause technique**
```javascript
router.get('/:id', authMiddleware, (req, res) => {
  const sql = `SELECT * FROM tasks WHERE id = ?`;
  db.get(sql, [req.params.id], (err, task) => {
    res.json(task);
  });
});
```
La tâche est récupérée uniquement à partir de son `id`, sans comparaison avec `req.user.id`.

**Exploitation**
Un utilisateur connecté avec le compte "bob" envoie une requête sur l'identifiant d'une tâche appartenant à "alice" :
```
GET /tasks/1
Authorization: Bearer <token_bob>
```
La tâche 1 appartient pourtant à alice (`ownerId: 1`).

**Preuve**
Voir Annexe — Captures (VULN-01), diaporama joint.

**Impact**
- Fuite de données personnelles entre utilisateurs
- Consultation d'informations confidentielles d'un tiers sans autorisation
- Perte de confiance des utilisateurs, risque RGPD

**Criticité** : Élevée

**Correction appliquée**
```javascript
router.get('/:id', authMiddleware, (req, res) => {
  const sql = `SELECT * FROM tasks WHERE id = ?`;
  db.get(sql, [req.params.id], (err, task) => {
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
    if (task.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    res.json(task);
  });
});
```
Le même contrôle a été ajouté sur `PUT /tasks/:id` et `DELETE /tasks/:id`.

**Validation après correction**
La même requête (bob consultant la tâche 1 d'alice) retourne désormais :
```
HTTP/1.1 403 Forbidden
{"error": "Accès refusé"}
```

---

### VULN-02 — Injection SQL

**Type**
Injection (SQLi)

**Endpoint concerné**
`GET /tasks/search/query?q=`

**Description**
La route de recherche de tâches construit la requête SQL par concaténation directe de l'entrée utilisateur, sans requête préparée.

**Cause technique**
```javascript
router.get('/search/query', authMiddleware, (req, res) => {
  const q = req.query.q || '';
  const sql = `SELECT * FROM tasks WHERE title LIKE '%${q}%'`;
  db.all(sql, [], (err, rows) => {
    res.json(rows);
  });
});
```

**Exploitation**
```
GET /tasks/search/query?q=' OR '1'='1
Authorization: Bearer <token_bob>
```
Le payload transforme la condition `WHERE title LIKE '%q%'` en une condition toujours vraie, retournant toutes les tâches de la base, y compris celles d'autres utilisateurs.

**Preuve**
Voir Annexe — Captures (VULN-02), diaporama joint.

**Impact**
- Contournement du contrôle d'accès
- Fuite massive de données
- Base d'attaque pour des injections plus poussées (extraction de données, altération)

**Criticité** : Critique

**Correction appliquée**
```javascript
router.get('/search/query', authMiddleware, (req, res) => {
  const q = req.query.q || '';
  const sql = `SELECT * FROM tasks WHERE title LIKE ? AND ownerId = ?`;
  db.all(sql, [`%${q}%`, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json(rows);
  });
});
```
Utilisation d'une requête préparée avec paramètres liés (`?`), et filtrage explicite sur l'utilisateur connecté.

**Validation après correction**
Le même payload (`' OR '1'='1`) ne retourne plus que les tâches appartenant à l'utilisateur connecté, aucune donnée d'un autre utilisateur n'est exposée.

---

### VULN-03 — XSS stocké

**Type**
Cross-Site Scripting (Stored XSS)

**Endpoint concerné**
`POST /tasks`, `PUT /tasks/:id`

**Description**
Le champ `description` d'une tâche est enregistré tel quel en base de données, sans nettoyage ni échappement. Le frontend affiche cette description via `dangerouslySetInnerHTML`, exécutant tout code HTML/JavaScript injecté.

**Cause technique**
```javascript
router.post('/', authMiddleware, (req, res) => {
  const { title, description } = req.body;
  const sql = `INSERT INTO tasks (title, description, ownerId) VALUES (?, ?, ?)`;
  db.run(sql, [title, description, req.user.id], function (err) {
    res.status(201).json({ message: 'Tâche créée', taskId: this.lastID });
  });
});
```

**Exploitation**
Création d'une tâche avec le payload suivant dans le champ description :
```html
<img src=x onerror="alert('XSS')">
```
Un `<script>` classique est filtré nativement par le moteur de rendu du navigateur lors d'une injection via `innerHTML`, mais un attribut d'événement HTML comme `onerror` contourne cette limitation et exécute le JavaScript dès l'affichage de la tâche.

**Preuve**
Voir Annexe — Captures (VULN-03), diaporama joint.

**Impact**
- Exécution de code arbitraire dans le navigateur d'un autre utilisateur
- Vol de session, actions effectuées à l'insu de la victime
- Vecteur d'attaque pour du phishing ou du vol de données

**Criticité** : Élevée

**Correction appliquée**
```javascript
function escapeHtml(text) {
  if (!text) return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.post('/', authMiddleware, (req, res) => {
  const title = escapeHtml(req.body.title);
  const description = escapeHtml(req.body.description);
  const sql = `INSERT INTO tasks (title, description, ownerId) VALUES (?, ?, ?)`;
  db.run(sql, [title, description, req.user.id], function (err) {
    res.status(201).json({ message: 'Tâche créée', taskId: this.lastID });
  });
});
```
Le même échappement est appliqué sur `PUT /tasks/:id`.

**Validation après correction**
Voir Annexe — Captures (VULN-03, validation), diaporama joint.
Le même payload (`<img src=x onerror="alert('XSS')">`) est désormais stocké et affiché sous forme de texte brut échappé, sans exécution de script.

---

### VULN-04 — Mass Assignment

**Type**
Mass Assignment

**Endpoint concerné**
`POST /auth/register`

**Description**
La route d'inscription accepte l'intégralité du corps de la requête (`req.body`) sans filtrer les champs autorisés, permettant à un utilisateur de définir lui-même son rôle.

**Cause technique**
```javascript
router.post('/register', (req, res) => {
  const { username, email, password, role } = req.body;
  const sql = `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`;
  db.run(sql, [username, email, hashedPassword, role || 'user'], function (err) {
    res.status(201).json({ message: 'Utilisateur créé', userId: this.lastID });
  });
});
```

**Exploitation**
```
POST /auth/register
{"username":"hacker","email":"hacker@test.com","password":"1234","role":"admin"}
```

**Preuve**
Voir Annexe — Captures (VULN-04), diaporama joint.

**Impact**
- Élévation de privilèges
- Prise de contrôle non autorisée de fonctionnalités sensibles réservées aux administrateurs

**Criticité** : Critique

**Correction appliquée**
```javascript
router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  const sql = `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`;
  db.run(sql, [username, email, hashedPassword, 'user'], function (err) {
    res.status(201).json({ message: 'Utilisateur créé', userId: this.lastID });
  });
});
```
Le champ `role` n'est plus lu depuis `req.body` ; il est toujours forcé à `'user'` côté serveur.

**Validation après correction**
La même requête contenant `"role":"admin"` crée désormais un compte avec `role: "user"`, quelle que soit la valeur envoyée par le client.

---

### VULN-05 — Authentification faible (JWT)

**Type**
Authentification faible

**Endpoint concerné**
`POST /auth/login`

**Description**
Le token JWT délivré à la connexion est signé avec un secret faible, hardcodé dans le code source, et ne comporte aucune date d'expiration.

**Cause technique**
```javascript
const JWT_SECRET = 'secret123';

const token = jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  JWT_SECRET
);
```

**Exploitation**
Un token obtenu via `/auth/login` est décodé sur jwt.io : le payload ne contient aucun champ `exp`, ce qui signifie que le token reste valide indéfiniment. Le secret `secret123` est de plus visible directement dans le code source, rendant possible la falsification de tokens si celui-ci fuite.

**Preuve**
Voir Annexe — Captures (VULN-05), diaporama joint.

**Impact**
- Un token volé (XSS, interception réseau, fuite de logs) reste exploitable indéfiniment
- Un secret faible ou deviné permettrait de forger de faux tokens valides

**Criticité** : Élevée

**Correction appliquée**
```javascript
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_env';

const token = jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  JWT_SECRET,
  { expiresIn: '1h' }
);
```
Le secret est désormais externalisé dans une variable d'environnement (fichier `.env`, exclu du versioning via `.gitignore`), et le token expire après 1 heure.

**Validation après correction**
Un token généré après correction contient un champ `exp` correspondant à une expiration 1h après l'émission ; une requête effectuée avec un token expiré est rejetée avec une erreur 403.

---

### VULN-06 — Security Misconfiguration / Information Disclosure

**Type**
Security Misconfiguration / Information Disclosure

**Endpoint concerné**
Global (CORS sur toutes les routes), `GET /tasks/search/query` (fuite d'erreur)

**Description**
Deux problèmes de configuration coexistent : une politique CORS totalement ouverte, et une gestion d'erreur qui expose des informations techniques sensibles au client (message d'erreur SQL brut, requête SQL complète, stack trace).

**Cause technique**
```javascript
app.use(cors());

app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack
  });
});
```
```javascript
db.all(sql, [], (err, rows) => {
  if (err) return res.status(500).json({ error: err.message, sql });
  res.json(rows);
});
```

**Exploitation**
Une requête provoquant volontairement une erreur SQL :
```
GET /tasks/search/query?q=test'
```
retourne :
```json
{
  "error": "SQLITE_ERROR: unrecognized token: \"'\"",
  "sql": "SELECT * FROM tasks WHERE title LIKE '%test'%'"
}
```
Par ailleurs, l'inspection des headers de réponse de n'importe quelle requête révèle :
```
Access-Control-Allow-Origin: *
```

**Preuve**
Voir Annexe — Captures (VULN-06), diaporama joint.

**Impact**
- N'importe quel site web tiers peut interroger l'API au nom d'une victime (CORS ouvert)
- La structure de la base de données et les messages d'erreur techniques facilitent la reconnaissance et d'autres attaques (ex : affinage d'une injection SQL)

**Criticité** : Moyenne à Élevée

**Correction appliquée**
```javascript
app.use(cors({
  origin: 'http://localhost:5173'
}));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Une erreur est survenue' });
});
```
```javascript
db.all(sql, [`%${q}%`, req.user.id], (err, rows) => {
  if (err) return res.status(500).json({ error: 'Erreur serveur' });
  res.json(rows);
});
```
Le CORS est restreint à l'origine légitime du frontend, et aucune information technique n'est plus renvoyée au client en cas d'erreur (l'erreur complète est uniquement journalisée côté serveur).

**Validation après correction**
La même requête provoquant une erreur SQL retourne désormais :
```json
{"error": "Erreur serveur"}
```
et le header `Access-Control-Allow-Origin` ne contient plus que `http://localhost:5173`.


## 7. Limites du projet

- L'application ne couvre que les fonctionnalités nécessaires à la démonstration des vulnérabilités demandées (pas de gestion de rôle admin poussée, pas de partage de tâches entre utilisateurs implémenté côté interface).
- La correction du stockage du token côté frontend (`localStorage`) n'a pas été traitée : un token reste accessible via JavaScript en cas de XSS résiduel ailleurs dans l'application. Une amélioration possible serait de migrer vers un cookie `HttpOnly`.
- Le rate limiting et la protection contre le brute force sur `/auth/login` n'ont pas été implémentés.
- Les tests automatisés (`npm test`) n'ont pas été mis en place, la validation des corrections a été faite manuellement via Postman.

## 8. Conclusion

Ce projet a permis de mettre en pratique un cycle complet de sécurité applicative : conception volontaire de vulnérabilités représentatives du Top 10 OWASP, exploitation contrôlée de chacune d'elles, documentation détaillée, puis correction des causes profondes plutôt que des symptômes de surface. Les six vulnérabilités intégrées (IDOR, injection SQL, XSS stocké, mass assignment, authentification faible, security misconfiguration) ont chacune été démontrées, corrigées, puis revalidées sur la branche `secure`.

## 9. Annexe — Captures

Les captures d'écran prouvant l'exploitation et la correction des vulnérabilités sont disponibles dans le diaporama de présentation associé à ce projet, envoyé séparément.

| Diapo (page) | Vulnérabilité | Contenu |
|---|---|---|
| p. 02 | VULN-01 | Requête Postman de bob sur `/tasks/1`, token visible, réponse contenant les données d'alice |
| p. 03 | VULN-02 | Requête avec payload `' OR '1'='1`, réponse contenant des tâches d'un autre utilisateur |
| p. 04 | VULN-03 | Réponse API montrant la description stockée sans échappement |
| p. 05 | VULN-03 | Popup `alert('XSS')` déclenchée dans le navigateur (branche `vulnerable`) |
| p. 05 | VULN-03 (validation) | Même payload affiché comme texte brut, sans exécution (branche `secure`) |
| p. 06 | VULN-04 | Requête d'inscription avec `"role":"admin"` et confirmation via `/debug/users` |
| p. 07 | VULN-05 | Token décodé sur jwt.io, absence du champ `exp` |
| p. 08 | VULN-06 | Header `Access-Control-Allow-Origin: *` visible dans la réponse |

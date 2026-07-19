import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:3000';

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(token ? parseJwt(token) : null);
  const [view, setView] = useState(token ? 'list' : 'auth');
  const [authTab, setAuthTab] = useState('login');
  const [authError, setAuthError] = useState('');
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (token) fetchTasks();
  }, [token]);

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError('');
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());

    if (authTab === 'register') {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json();
        setAuthError(data.error || 'Erreur inscription');
        return;
      }
      setAuthTab('login');
      setAuthError('Compte créé, connecte-toi maintenant.');
      return;
    }

    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json();
      setAuthError(data.error || 'Erreur connexion');
      return;
    }
    const data = await res.json();
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(parseJwt(data.token));
    setView('list');
  }

  function logout() {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setView('auth');
  }

  async function fetchTasks() {
    const res = await fetch(`${API_URL}/tasks/mine`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }

  async function handleSearch(e) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/tasks/search/query?q=${encodeURIComponent(search)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
  }

  async function openTask(id) {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setSelectedTask(data);
    setView('detail');
  }

  async function handleCreate(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    e.target.reset();
    await fetchTasks();
    setView('list');
  }

  if (view === 'auth') {
    return (
      <div className="app">
        <div className="auth-card">
          <h2>TaskManager</h2>
          <div className="auth-tabs" style={{ marginTop: 20 }}>
            <div
              className={`auth-tab ${authTab === 'login' ? 'active' : ''}`}
              onClick={() => setAuthTab('login')}
            >
              Connexion
            </div>
            <div
              className={`auth-tab ${authTab === 'register' ? 'active' : ''}`}
              onClick={() => setAuthTab('register')}
            >
              Inscription
            </div>
          </div>
          {authError && <div className="error-banner">{authError}</div>}
          <form onSubmit={handleAuth}>
            {authTab === 'register' && (
              <div className="field">
                <label>Nom d'utilisateur</label>
                <input name="username" required />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" required />
            </div>
            <div className="field">
              <label>Mot de passe</label>
              <input name="password" type="password" required />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>
              {authTab === 'login' ? 'Se connecter' : "S'inscrire"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-brand-mark" />
          <h1 style={{ fontSize: 18 }}>TaskManager</h1>
        </div>
        <div className="topbar-user">
          <span>{user?.username}</span>
          <span className={`role-badge ${user?.role === 'admin' ? 'admin' : ''}`}>
            {user?.role}
          </span>
          <button className="btn btn-ghost" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </div>

      <div className="container">
        {view === 'list' && (
          <>
            <div className="page-header">
              <h2>Mes tâches</h2>
              <button className="btn btn-primary" onClick={() => setView('create')}>
                Nouvelle tâche
              </button>
            </div>
            <form className="search-row" onSubmit={handleSearch}>
              <input
                placeholder="Rechercher une tâche..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-ghost" type="submit">
                Rechercher
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchTasks();
                }}
              >
                Réinitialiser
              </button>
            </form>
            {tasks.length === 0 && (
              <div className="empty-state">Aucune tâche pour l'instant.</div>
            )}
            {tasks.map((t) => (
              <div
                key={t.id}
                className={`task-card ${t.status === 'done' ? 'status-done' : ''}`}
                onClick={() => openTask(t.id)}
              >
                <div className="task-card-title">{t.title}</div>
                <div className="task-card-meta mono">
                  #{t.id} · owner {t.ownerId} · {t.status}
                </div>
              </div>
            ))}
          </>
        )}

        {view === 'create' && (
          <>
            <button className="back-link" onClick={() => setView('list')}>
              ← Retour
            </button>
            <h2 style={{ marginBottom: 20 }}>Nouvelle tâche</h2>
            <form onSubmit={handleCreate}>
              <div className="field">
                <label>Titre</label>
                <input name="title" required />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea name="description" />
              </div>
              <button className="btn btn-primary">Créer la tâche</button>
            </form>
          </>
        )}

        {view === 'detail' && selectedTask && (
          <>
            <button className="back-link" onClick={() => setView('list')}>
              ← Retour
            </button>
            <div className="detail-card">
              <h2>{selectedTask.title}</h2>
              <div className="detail-meta mono">
                #{selectedTask.id} · owner {selectedTask.ownerId} · {selectedTask.status}
              </div>
              <div
                className="detail-description"
                dangerouslySetInnerHTML={{ __html: selectedTask.description || '' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

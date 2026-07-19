const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_env';

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
}

router.post('/', authMiddleware, (req, res) => {
  const { title, description } = req.body;

  const sql = `INSERT INTO tasks (title, description, ownerId) VALUES (?, ?, ?)`;
  db.run(sql, [title, description, req.user.id], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.status(201).json({ message: 'Tâche créée', taskId: this.lastID });
  });
});

router.get('/mine', authMiddleware, (req, res) => {
  const sql = `SELECT * FROM tasks WHERE ownerId = ?`;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/:id', authMiddleware, (req, res) => {
  const sql = `SELECT * FROM tasks WHERE id = ?`;
  db.get(sql, [req.params.id], (err, task) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });

    if (task.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json(task);
  });
});

router.get('/search/query', authMiddleware, (req, res) => {
  const q = req.query.q || '';
  const sql = `SELECT * FROM tasks WHERE title LIKE ? AND ownerId = ?`;

  db.all(sql, [`%${q}%`, req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    res.json(rows);
  });
});

router.put('/:id', authMiddleware, (req, res) => {
  const { title, description, status } = req.body;

  db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id], (err, task) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
    if (task.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const sql = `UPDATE tasks SET title = ?, description = ?, status = ? WHERE id = ?`;
    db.run(sql, [title, description, status, req.params.id], function (err) {
      if (err) return res.status(500).json({ error: 'Erreur serveur' });
      res.json({ message: 'Tâche mise à jour' });
    });
  });
});

router.delete('/:id', authMiddleware, (req, res) => {
  db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id], (err, task) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    if (!task) return res.status(404).json({ error: 'Tâche introuvable' });
    if (task.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: 'Erreur serveur' });
      res.json({ message: 'Tâche supprimée' });
    });
  });
});

module.exports = router;
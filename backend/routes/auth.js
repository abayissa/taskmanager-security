const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret_in_env";

router.post("/register", (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Champs manquants" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const sql = `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`;
  db.run(sql, [username, email, hashedPassword, "user"], function (err) {
    if (err) {
      return res
        .status(400)
        .json({ error: "Utilisateur déjà existant ou erreur." });
    }
    res.status(201).json({ message: "Utilisateur créé", userId: this.lastID });
  });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = `SELECT * FROM users WHERE email = ?`;
  db.get(sql, [email], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.json({ message: "Connexion réussie", token });
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const validateUserInput = require('../utils/validation');

require('dotenv').config();

// Register Normal User
router.post('/register', async (req, res) => {
  try {
    const { name, email, address, password } = req.body;
    const validationError = validateUserInput({ name, email, address, password });
    if (validationError) return res.status(400).json({ message: validationError });

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      'INSERT INTO users (name, email, password, address, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, address, 'normal']
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login for all users
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ message: 'Missing email or password' });
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const tokenPayload = { id: user.id, role: user.role, email: user.email, name: user.name };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'secretkey', { expiresIn: '8h' });

    res.json({ token, role: user.role, name: user.name, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

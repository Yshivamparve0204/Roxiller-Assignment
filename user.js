const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const validateUserInput = require('../utils/validation');

// Update password for logged in user
router.put('/password', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords required' });
    }
    if(!/^(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,16}$/.test(newPassword)) {
      return res.status(400).json({ message: 'New password must be 8-16 chars, one uppercase and one special char' });
    }

    // Get current hashed password
    const [[user]] = await pool.query('SELECT password FROM users WHERE id = ?', [userId]);
    const validOld = await bcrypt.compare(oldPassword, user.password);
    if (!validOld) return res.status(400).json({ message: 'Old password incorrect' });

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedNew, userId]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, permit } = require('../middleware/auth');

// Normal user: Submit or modify rating for a store
router.post('/', verifyToken, permit('normal'), async (req, res) => {
  try {
    const { store_id, rating } = req.body;
    const userId = req.user.id;
    if (!store_id || !rating) return res.status(400).json({ message: 'store_id and rating required' });
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Rating must be 1 to 5' });

    // Check store exists
    const [stores] = await pool.query('SELECT id FROM stores WHERE id = ?', [store_id]);
    if (stores.length === 0) return res.status(400).json({ message: 'Store not found' });

    // Check if rating exists from this user for this store
    const [existing] = await pool.query('SELECT id FROM ratings WHERE user_id = ? AND store_id = ?', [userId, store_id]);
    if (existing.length === 0) {
      // Insert new rating
      await pool.query('INSERT INTO ratings (user_id, store_id, rating) VALUES (?, ?, ?)', [userId, store_id, rating]);
    } else {
      // Update rating
      await pool.query('UPDATE ratings SET rating = ? WHERE user_id = ? AND store_id = ?', [rating, userId, store_id]);
    }
    res.json({ message: 'Rating submitted/updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

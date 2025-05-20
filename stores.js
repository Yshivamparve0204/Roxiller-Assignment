const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, permit } = require('../middleware/auth');

// Open route: Get all stores for normal users with search and sort
router.get('/', verifyToken, permit('normal', 'admin', 'store_owner'), async (req, res) => {
  try {
    const { name, address, sortBy = 'name', sortDir = 'ASC' } = req.query;

    let filter = 'WHERE 1=1';
    const params = [];
    if (name) {
      filter += ' AND s.name LIKE ?';
      params.push(`%${name}%`);
    }
    if (address) {
      filter += ' AND s.address LIKE ?';
      params.push(`%${address}%`);
    }
    const allowedSortColumns = ['s.name', 's.address', 'rating'];
    const orderBy = allowedSortColumns.includes(sortBy) ? sortBy : 's.name';
    const orderDir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    // We join ratings to compute average rating and user's submitted rating if user is normal user
    // Get user id from token if normal user to show their rating
    const userId = req.user.id;

    const sql = `
      SELECT s.id, s.name, s.address, 
        IFNULL(AVG(r.rating), 0) AS overall_rating,
        (SELECT rating FROM ratings WHERE user_id=? AND store_id=s.id LIMIT 1) AS user_rating
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      ${filter}
      GROUP BY s.id
      ORDER BY ${orderBy} ${orderDir}
    `;

    const [rows] = await pool.query(sql, [userId, ...params]);
    // Transform rating fields
    const response = rows.map(row => ({
      id: row.id,
      name: row.name,
      address: row.address,
      overall_rating: parseFloat(row.overall_rating).toFixed(2),
      user_rating: row.user_rating ? row.user_rating : null
    }));

    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// For store owners: Get list of users who submitted ratings for their store and average rating
router.get('/owner/dashboard', verifyToken, permit('store_owner'), async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Get stores owned by user
    const [stores] = await pool.query('SELECT id, name FROM stores WHERE owner_id = ?', [ownerId]);
    if (!stores.length) {
      return res.json({ stores: [], average_rating: 0 });
    }
    const storeIds = stores.map(s => s.id);

    // For each store, get users who rated and ratings
    const [userRatings] = await pool.query(`
      SELECT u.id as user_id, u.name as user_name, u.email as user_email, r.rating, r.store_id
      FROM ratings r
      JOIN users u ON u.id = r.user_id
      WHERE r.store_id IN (?)
      ORDER BY u.name ASC
    `, [storeIds]);

    // Get average rating for all stores owned by user
    const [[{ avg_rating }]] = await pool.query(`
      SELECT AVG(r.rating) AS avg_rating
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      WHERE s.owner_id = ?
    `, [ownerId]);

    // Group user ratings by store
    let storeUserRatings = {};
    stores.forEach(s => {
      storeUserRatings[s.id] = {store_name: s.name, ratings: []};
    });
    userRatings.forEach(ur => {
      if(storeUserRatings[ur.store_id]){
        storeUserRatings[ur.store_id].ratings.push({
          user_id: ur.user_id,
          user_name: ur.user_name,
          user_email: ur.user_email,
          rating: ur.rating
        });
      }
    });

    res.json({ 
      stores: storeUserRatings,
      average_rating: avg_rating ? parseFloat(avg_rating).toFixed(2) : "0.00" 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

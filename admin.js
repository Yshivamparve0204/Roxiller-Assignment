const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { permit } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const validateUserInput = require('../utils/validation');

// Only admin permitted
router.use(permit('admin'));

// Admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [[{ total_users }]] = await pool.query('SELECT COUNT(*) AS total_users FROM users');
    const [[{ total_stores }]] = await pool.query('SELECT COUNT(*) AS total_stores FROM stores');
    const [[{ total_ratings }]] = await pool.query('SELECT COUNT(*) AS total_ratings FROM ratings');
    res.json({ total_users, total_stores, total_ratings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin add users (admin or normal)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, address, role } = req.body;
    if (!['admin', 'normal', 'store_owner'].includes(role)) 
      return res.status(400).json({ message: 'Invalid role' });
    const validationError = validateUserInput({ name, email, address, password });
    if (validationError) return res.status(400).json({ message: validationError });

    const [exists] = await pool.execute('SELECT id FROM users WHERE email=?', [email]);
    if (exists.length > 0) return res.status(400).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute('INSERT INTO users (name, email, password, address, role) VALUES (?, ?, ?, ?, ?)', 
      [name, email, hashedPassword, address, role]);
    res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin add stores
router.post('/stores', async (req, res) => {
  try {
    const { name, email, address, owner_id } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and Email required' });
    // Check for duplicate store email
    const [exists] = await pool.execute('SELECT id FROM stores WHERE email = ?', [email]);
    if (exists.length > 0) return res.status(400).json({ message: 'Store email already exists' });
    // Validate owner_id exists and is store_owner
    if (owner_id) {
      const [owner] = await pool.execute('SELECT id FROM users WHERE id = ? AND role = ?', [owner_id, 'store_owner']);
      if (owner.length === 0) return res.status(400).json({ message: 'Invalid store owner' });
    }
    await pool.execute(
      'INSERT INTO stores (name, email, address, owner_id) VALUES (?, ?, ?, ?)',
      [name, email, address, owner_id || null]
    );
    res.status(201).json({ message: 'Store added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all stores with filters and sorting
router.get('/stores', async (req, res) => {
  try {
    const { name, email, address, sortBy = 'name', sortDir = 'ASC' } = req.query;

    let filter = 'WHERE 1=1';
    const params = [];
    if (name) {
      filter += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    if (email) {
      filter += ' AND email LIKE ?';
      params.push(`%${email}%`);
    }
    if (address) {
      filter += ' AND address LIKE ?';
      params.push(`%${address}%`);
    }
    const allowedSortColumns = ['name', 'email', 'address'];
    const orderBy = allowedSortColumns.includes(sortBy) ? sortBy : 'name';
    const orderDir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const sql = `
      SELECT s.id, s.name, s.email, s.address,
      IFNULL(AVG(r.rating),0) AS rating
      FROM stores s
      LEFT JOIN ratings r ON s.id = r.store_id
      ${filter}
      GROUP BY s.id
      ORDER BY ${orderBy} ${orderDir}
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all normal + admin users with filters and sorting
router.get('/users', async (req, res) => {
  try {
    // Filters
    const { name, email, address, role, sortBy = 'name', sortDir = 'ASC' } = req.query;
    const allowedRoles = ['admin', 'normal', 'store_owner'];
    let filter = 'WHERE role IN ("admin", "normal")';
    const params = [];
    if (name) {
      filter += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    if (email) {
      filter += ' AND email LIKE ?';
      params.push(`%${email}%`);
    }
    if (address) {
      filter += ' AND address LIKE ?';
      params.push(`%${address}%`);
    }
    if (role && allowedRoles.includes(role)) {
      filter += ' AND role = ?';
      params.push(role);
    }
    const allowedSortColumns = ['name', 'email', 'address', 'role'];
    const orderBy = allowedSortColumns.includes(sortBy) ? sortBy : 'name';
    const orderDir = sortDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const sql = `
      SELECT id, name, email, address, role
      FROM users
      ${filter}
      ORDER BY ${orderBy} ${orderDir}
    `;
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user details by id
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Invalid user ID' });
    const [[user]] = await pool.query('SELECT id, name, email, address, role FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'store_owner') {
      // Average rating for stores owned by the user
      const [[result]] = await pool.query(`
        SELECT IFNULL(AVG(r.rating),0) as avg_rating
        FROM stores s
        LEFT JOIN ratings r ON s.id = r.store_id
        WHERE s.owner_id = ?
      `, [userId]);
      user.average_rating = result.avg_rating;
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin logout handled client side by deleting token. No backend required

module.exports = router;

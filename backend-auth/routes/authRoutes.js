const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Route for registering a new user
router.post('/signup', registerUser);

// Route for logging in
router.post('/login', loginUser);

// Protected route to get user profile
router.get('/profile', protect, getUserProfile);

module.exports = router;

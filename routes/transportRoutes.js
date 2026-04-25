const express = require('express');
const router = express.Router();
const { getRoutes, addRoute, deleteRoute } = require('../controllers/transportController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getRoutes)
    .post(protect, adminOnly, addRoute);

router.route('/:id')
    .delete(protect, adminOnly, deleteRoute);

module.exports = router;

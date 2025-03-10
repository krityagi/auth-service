const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');
const RedisStore = require('connect-redis')(session);
const redis = require('redis');

dotenv.config();

const authRoutes = require('./routes/authRoutes').router;

const app = express();
const port = process.env.PORT || 3000;
console.log('DB_USERNAME:', process.env.DB_USERNAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD);
console.log('SESSION_SECRET:', process.env.SESSION_SECRET);
const MONGO_URI = `mongodb://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@mongo:27017/authService?authSource=admin`;


mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected for Auth Service'))
    .catch(err => console.log('MongoDB connection error: ', err));

const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'redis-service',
    port: process.env.REDIS_PORT || 6379,
    retry_strategy: function(options) {
        console.log('Redis retry attempt:', options.attempt);
        return Math.min(options.attempt * 100, 3000);
    }
});

redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
});

app.use(session({
    store: new RedisStore({ 
        client: redisClient,
        prefix: 'sess:',
        ttl: 86400 // 24 hours
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: { 
        secure: false,
        httpOnly: true,
        sameSite: 'Lax',
        domain: 'devopsduniya.in',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Updated session middleware
app.use((req, res, next) => {
    console.log('Session middleware:', {
        hasSession: !!req.session,
        sessionID: req.sessionID,
        cookie: req.session ? req.session.cookie : null,
        user: req.session ? req.session.user : null
    });

    if (!req.session) {
        console.error('Session is undefined. Ensure session middleware is initialized.');
    } else if (!req.session.user) {
        console.warn('Session exists, but user is not set.');
    } else {
        console.log('Session user:', req.session.user);
    }
    next();
});

// Add explicit error handling for session store
app.use((err, req, res, next) => {
    console.error('Session error:', err);
    if (err.code === 'ECONNREFUSED') {
        console.error('Redis connection refused');
    }
    next(err);
});
// Health check endpoint
app.get('/healthz', (req, res) => {
    res.status(200).send('OK');
});

// Readiness check endpoint
app.get('/readiness', (req, res) => {
    res.status(200).send('Ready');
});

// Add cache control headers
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

// Add a route to handle GET requests to the root URL
app.get('/', (req, res) => {
    res.redirect('/login');
});


// Routes
app.use(authRoutes);

app.listen(port, () => {
    console.log(`Auth Service is running on http://localhost:${port}/login`);
});

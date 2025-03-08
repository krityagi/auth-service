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
    port: process.env.REDIS_PORT || 6379
});

redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('error', (err) => {
    console.log('Redis client error:');
});
      

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false,
        sameSite: 'Lax',
        domain: 'devopsduniya.in',
        path: '/'
     },
    logErrors: true
}));

// Middleware to make user data available in all templates
app.use((req, res, next) => {
    res.locals.user = req.session.user; // Make user available in templates
    next();
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



/*app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email }); // Log login attempt

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        req.session.user = user; // Set user session
        console.log('Session created:', req.session); // Log session creation
        res.status(200).json({ message: 'Login successful', redirectUrl: '/dashboard' });

        // After successful login, make a request to the dashboard-service
        const dashboardServiceUrl = process.env.DASHBOARD_SERVICE_URL || 'http://dashboard-service-internal:3000';
        try {
            const response = await axios.get(`${dashboardServiceUrl}/dashboard`, {
                headers: { Cookie: req.headers.cookie }
            });
            console.log('Dashboard response:', response.data);
        } catch (error) {
            console.error('Error calling dashboard-service:', error);
        }
    } catch (err) {
        return res.status(500).json({ message: 'Error during login: ' + err.message });
    }
});*/


// Routes
app.use(authRoutes);

app.listen(port, () => {
    console.log(`Auth Service is running on http://localhost:${port}/login`);
});

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');

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

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
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
    res.send('Welcome to the Home Page!');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Perform login logic here...

    // Read the dashboard service URL from environment variables
    const dashboardServiceUrl = process.env.DASHBOARD_SERVICE_URL || 'http://dashboard-service-internal:3000';

    // After successful login, make a request to the dashboard-service
    try {
        const response = await axios.get(`${dashboardServiceUrl}/dashboard`, {
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Resolve only if the status code is less than 400
            }
        });
        if (response.status === 302) {
            res.redirect('/dashboard');
        } else {
            console.log('Dashboard response:', response.data);
            res.redirect('/dashboard');
        }
    } catch (error) {
        console.error('Error calling dashboard-service:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Routes
app.use(authRoutes);

app.listen(port, () => {
    console.log(`Auth Service is running on http://localhost:${port}/login`);
});

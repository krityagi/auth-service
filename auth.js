const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

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

// Add a route to handle GET requests to the root URL
app.get('/', (req, res) => {
    res.send('Welcome to the Home Page!');
});

// Routes
app.use(authRoutes);

app.listen(port, () => {
    console.log(`Auth Service is running on http://localhost:${port}/login`);
});

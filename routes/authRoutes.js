const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const router = express.Router();

require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.status(401).redirect('/login');
    }
}

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.',
});

router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/login.html'));
});

router.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
});

router.post('/register', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });

        await newUser.save();
        return res.status(200).json({ message: 'Registration successful' });
    } catch (err) {
        return res.status(500).json({ message: 'Error saving user: ' + err.message });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        req.session.user = user;
        return res.status(200).json({ message: 'Login successful', redirectUrl: '/dashboard' });
    } catch (err) {
        return res.status(500).json({ message: 'Error during login: ' + err.message });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.status(200).json({ message: 'Logout successful', redirectUrl: '/login' });
    });
});

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(400).send('No account found with that email');
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    const resetLink = `http://localhost:4000/reset-password/${token}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Password Reset',
        text: `You requested a password reset. Click the link below to reset your password:\n${resetLink}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send('Error sending email');
        }
        res.send('Password reset link sent');
    });
});

router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: Date.now() } });

        if (!user) {
            return res.status(400).send('Token is invalid or expired');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;

        await user.save();
        res.redirect('/login');
    } catch (err) {
        res.status(500).send('Error resetting password: ' + err);
    }
});

module.exports.router = router;

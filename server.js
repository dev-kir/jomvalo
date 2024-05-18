const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require('body-parser');
const requestIP = require('request-ip');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const csurf = require('csurf');
const csrfProtection = csurf({ cookie: true });

require('dotenv').config();

// Dynamic import of node-fetch
let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/assets', express.static('assets'));

// Add middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestIP.mw());
app.use(cookieParser());
app.use(csrfProtection);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

const validateUsername = [
    body('username').trim().escape().notEmpty().withMessage('Username is required')
];

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

//  ROUTES

app.get("/", (req, res) => {
    const username = req.cookies.username;
    res.render('index', { username, csrfToken: req.csrfToken() });
});

app.post("/set-username", validateUsername, handleValidationErrors, csrfProtection, async (req, res) => {
    const { username, 'cf-turnstile-response': token } = req.body;

    try {
        const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `secret=${secretKey}&response=${token}`
        });

        const data = await response.json();

        if (data.success) {
            res.cookie('username', username, { maxAge: 900000, httpOnly: true });
            res.redirect('/');
        } else {
            res.status(400).send('Turnstile verification failed. Please try again.');
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send('Internal Server Error');
    }
});

app.post("/letsgo", csrfProtection, (req, res) => {
    const username = req.cookies.username;
    const { location } = req.body;
    res.render('letsgo', { username, location });
});

app.post("/tete", async (req, res) => {
    try {
        // Retry logic
        let retries = 15; // Number of retries
        while (retries > 0) {
            try {
                const token = process.env.TELEGRAM_TOKEN;
                const chat_id = process.env.TELEGRAM_CHAT_ID;
                const ipAddress = req.socket.remoteAddress;
                const message = "("+ ipAddress + "): " + req.body.message;
                await axios.get(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${message}`);
                res.status(200).json({ success: true });
                return; // Exit the function after successful request
            } catch (error) {
                console.error("Error:", error);
                retries--; // Decrement the number of retries
            }
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
});

// route random links to root
app.get("*", (req, res) => {
    res.redirect('/');
})

app.listen(8080, () => {
    console.log(`Running on port 8080`);
})
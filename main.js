const express = require('express');
const log4js = require('log4js');
const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Ensure the log directory exists
const logDirectory = path.join(__dirname, process.env.LOG_DIR);
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory);
}

// Get the current date in YYYY-MM-DD format
const currentDate = new Date().toISOString().split('T')[0];

// Configure log4js with dynamic file name and custom date format
log4js.configure({
    appenders: {
        file: {
            type: 'file',
            filename: path.join(logDirectory, `CDR-${currentDate}.log`),
            layout: {
                type: 'pattern',
                pattern: '[%d{yyyy-MM-dd hh:mm:ss}] %p %c - %m'  // Custom date format
            }
        }
    },
    categories: { default: { appenders: ['file'], level: 'info' } }
});

const logger = log4js.getLogger();

// MySQL Database Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        logger.error('Error connecting to the database:', err);
        return;
    }
    logger.info('Connected to MySQL database');
});

// Your app logic...

// Create REST API
const app = express();
const port = process.env.PORT || 3000; // Use the port from .env or default to 3000

// Endpoint to fetch all CDR data
app.get('/cdr/all', (req, res) => {
    res.json(cdrData);  // Return all CDR data stored in cdrData
});

// Handle app termination (e.g., Ctrl+C, SIGTERM)
const stopApp = () => {
    logger.info('Application is stopping...');  // Log when the app stops
    db.end();  // Close MySQL connection
    
    // Ensure log4js flushes remaining logs before exiting
    log4js.shutdown(() => {
        logger.info('Log4js has flushed remaining logs');
        process.exit(0);  // Exit the process after logs are written
    });
};

// Listen for termination signals
process.on('SIGINT', stopApp);  // Handle Ctrl+C
process.on('SIGTERM', stopApp); // Handle termination signal

// Start the server and log the start time
app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});

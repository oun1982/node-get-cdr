const AsteriskManager = require('asterisk-manager');
const express = require('express');
const log4js = require('log4js');
const mysql = require('mysql2');

// Configure log4js
log4js.configure({
    appenders: { file: { type: 'file', filename: 'cdr.log' } },
    categories: { default: { appenders: ['file'], level: 'info' } }
});

const logger = log4js.getLogger();

// MySQL Database Connection
const db = mysql.createConnection({
    host: '192.168.10.20',
    user: 'dcall',
    password: 'dcallpass',  // Replace with your MySQL password
    database: 'dcall' // Replace with your CDR database name
});

db.connect(err => {
    if (err) {
        logger.error('Error connecting to the database:', err);
        return;
    }
    logger.info('Connected to MySQL database');
});

// Fetch CDR data from MySQL and populate cdrData
let cdrData = [];
const fetchCDRDataFromDB = () => {
    const query = `
    SELECT 
      uniqueid, 
      channel, 
      dst, 
      DATE_FORMAT(completedate, '%Y-%m-%d %H:%i:%s') AS formatted_completedate
    FROM dialtraffic
    WHERE 
      calltype = 'O' 
      AND agentid != 0 
      and completedate BETWEEN NOW() - INTERVAL 30 DAY AND NOW()
    ORDER BY completedate DESC
  `;
    
    db.query(query, (err, results) => {
        if (err) {
            logger.error('Error fetching CDR data from MySQL:', err);
            return;
        }

        // Populate cdrData array with the fetched records
        cdrData = results.map(row => ({
            uniqueid: row.uniqueid,
            channel: row.channel.replace(/^PJSIP\//, '').split('-')[0],  // Adjust channel format
            destination: row.dst,
            endtime: row.formatted_completedate
        }));

        logger.info('CDR data loaded from MySQL:', cdrData.length, 'records');
    });
};

// Fetch data when the server starts
fetchCDRDataFromDB();

// Connect to Asterisk Manager
const ami = new AsteriskManager(5038, '192.168.10.20', 'clicktocall', '482b324e64935e035edd96f60beb5d71', true);
ami.keepConnected();

// Capture CDR events
ami.on('cdr', (event) => {
    logger.info(`New CDR: ${JSON.stringify(event)}`);

    // Extract the number from the channel field (e.g., 'PJSIP/2510-0000020a' -> '2510')
    const channelNumber = event['channel'].replace(/^PJSIP\//, '').split('-')[0];

    // Check if the destination has more than 6 digits
    if (event['destination'] && event['destination'].length > 6) {
        // Store specific fields in the CDR data
        cdrData.push({
            uniqueid: event['uniqueid'],
            channel: channelNumber,
            destination: event['destination'],
            endtime: event['endtime']
        });
    }
});

// Create REST API
const app = express();
const port = 3000;

// Endpoint to fetch all CDR data
app.get('/cdr/all', (req, res) => {
    res.json(cdrData);  // Return all CDR data stored in cdrData
});

// Search for CDR by number (filter by destination or channel)
app.get('/cdr/:number', (req, res) => {
    const number = req.params.number;
    const filteredData = cdrData.filter(cdr =>
        cdr['destination'] === number || cdr['channel'] === number
    );

    if (filteredData.length > 0) {
        // Sort by the endtime (assuming 'endtime' is in a sortable format like 'YYYY-MM-DD HH:mm:ss')
        filteredData.sort((a, b) => new Date(b.endtime) - new Date(a.endtime));

        // Get the most recent entry (the latest one after sorting)
        const latestCDR = filteredData[0];  // This will be the most recent CDR
        res.json(latestCDR);
    } else {
        res.status(404).json({ message: 'No CDR data found for this number' });
    }
});

// Start the server
app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});

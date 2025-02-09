const AsteriskManager = require('asterisk-manager');
const express = require('express');
const log4js = require('log4js');

// Configure log4js
log4js.configure({
    appenders: { file: { type: 'file', filename: 'cdr.log' } },
    categories: { default: { appenders: ['file'], level: 'info' } }
});

const logger = log4js.getLogger();

// Connect to Asterisk Manager
const ami = new AsteriskManager(5038, '192.168.10.20', 'clicktocall', '482b324e64935e035edd96f60beb5d71', true);
ami.keepConnected();

let cdrData = [];

// Capture CDR events
ami.on('cdr', (event) => {
    logger.info(`New CDR: ${JSON.stringify(event)}`);

    // Extract the number from the channel field (e.g., 'PJSIP/2510-0000020a' -> '2510')
    const channelNumber = event['channel'].replace(/^PJSIP\//, '').split('-')[0];

    // Check if the destination has more than 6 digits
    if (event['destination'] && event['destination'].length > 6) {
        // Store specific fields in the CDR data
        cdrData.push({
            qniqueid: event['uniqueid'],
            channel: channelNumber,
            destination: event['destination'],
            endtime: event['endtime']
        });
    }
});

// Create REST API
const app = express();
const port = 3000;

app.get('/cdr/all', (req, res) => {
    // console.log(cdrData);
    res.json(cdrData);  // Return all CDR data stored in cdrData
});


// Search CDR records by caller or callee number
app.get('/cdr/:number', (req, res) => {
    const number = req.params.number;
    const filteredData = cdrData.filter(cdr =>
        cdr['destination'] === number || cdr['channel'] === number
    );

    if (filteredData.length > 0) {
        // Sort by the endtime (assuming 'endtime' is in a sortable format like 'YYYY-MM-DD HH:mm:ss')
        filteredData.sort((a, b) => new Date(b.endtime) - new Date(a.endtime));

        // Get the most recent entry
        const latestCDR = filteredData[0];
        res.json(latestCDR);
    } else {
        res.status(404).json({ message: 'No CDR data found for this number' });
    }
});


app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
});

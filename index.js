const express = require('express'); // Library than creates and manages REST requests
const ejs = require('ejs'); // Library to render HTML pages for web browsers
const fs = require('fs'); // Library to read files from disk
const csv = require('csv-parser'); // Library to parse CSVs

const app = express(); // Initialise the REST app
const database = {};

var rows = []; // Create an array to store the rows from our CSV data

/*
 * Ensure that the user has defined a csv file to load!
 */
if (process.argv.length < 3) {
	console.log('No input files specified!');
	process.exit();
}

/*
 * Itterate over each file and call loadFile() to load it
 */
for (i=2;i<process.argv.length;i++) {
	file = process.argv[i];
	loadFile(file);
}

/*
 * The function that loads the file into our rows object
 */
function loadFile(file, input) {
    console.log(file + " loading...");
    if (!database[input]) {
        database[input] = [];
    }

    const rows = database[input];
    fs.createReadStream(file)
        .pipe(csv())
        .on('data', (data) => {
            rows.push(data);
        })
        .on('end', () => {
            console.log(file + " loaded");
        });
}

/*
 * Function to handle the users REST request
 */
function handleRequest(req,res) {
    // Get the path they have asked for and the file type.
    prefix = req.params["prefix"];
    heading = req.params["column_heading"];
    value = req.params["value"];

    // Also manage query parameters at the same time
    filter = req.query;
    if (heading) {
        filter[heading] = value;
    }

    // Protect the user from a massive file download!
    if (prefix == "LFB" && Object.keys(filter).length === 0) {
        res.status(400).send('This dataset is too large to serve all of it in one request');
    }

    // Filter the data according to the request to only contain relevant rows
    result = database[prefix];
    result = result.filter(function(item) {
    for(var key in filter) {
        if(item[key] === undefined || item[key] != filter[key])
            return false;
        }
        return true;
    });

    // Work out what the client asked for, the ".ext" specified always overrides content negotiation
    ext = req.params["ext"];
    // If there is no extension specified then manage it via content negoition, yay!
    if (!ext) {
        accepts = req.accepts(['json','csv','html']);
        if (accepts == "html" && value != undefined && Object.keys(req.query).length === 0) {
            res.redirect(301,req.originalUrl + ".html");
        } else {
            ext = accepts;
        }
    }

    // Return the data to the user in a format they asked for
    // CSV, JSON or by default HTML (web page)
    if (ext == "csv") {
        res.set('Content-Type', 'text/csv');
        res.send(json2csv(result));
    } else if (ext == "json") {
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(result,null,4));
    } else if (ext == "html") {
        ejs.renderFile(__dirname + '/page.html', { path: req.path, query: req.query }, function(err,data) {
            res.send(data);
        });
    }
};

// Custom function to convert JSON data to CSV
function json2csv(jsonData) {
    console.log(jsonData);
    if (jsonData.length === 0) {
        return '';
    }

    const headers = Object.keys(jsonData[0]);
    const csvData = [headers.join(',')];

    jsonData.forEach((item) => {
        const row = headers.map((header) => {
            const value = item[header] || '';
            return `"${value}"`;
        });
        csvData.push(row.join(','));
    });

    return csvData.join('\n');
}

/*
 * Set the available REST endpoints and how to handle them
 */
app.get('/', function(req,res) { handleRequest(req,res); });
app.get('/:column_heading/:value.:ext', function(req,res) { handleRequest(req,res); });
app.get('/:column_heading/:value', function(req,res) { handleRequest(req,res); });

/*
 * Start the app!
 */
app.listen(3000, () => console.log('Example app listening on port 3000!'));
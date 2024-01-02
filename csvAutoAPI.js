const express = require('express'); // Library than creates and manages REST requests
const ejs = require('ejs'); // Library to render HTML pages for web browsers
const fs = require('fs'); // Library to read files from disk
const path = require('path'); // Import the 'path' module
const csv = require('csv-parser'); // Library to parse CSVs
const fastcsv = require('fast-csv');
const { MongoClient, ObjectId } = require('mongodb'); // Import MongoDB package
require("dotenv").config({ path: "./config.env" });
const mongoURI = process.env.MONGO_URI || false;
const mongoDB = process.env.MONGO_DB || false;
const port = process.env.PORT || 3000;

const app = express(); // Initialise the REST app
const database = {};

var rows = []; // Create an array to store the rows from our CSV data

/*
 * Ensure that the user has defined a csv file to load!
 */
if (process.argv.length < 3 && !mongoURI) {
	console.log('No input files specified!');
	process.exit();
}

/*
 * Itterate over each file and call loadFile() to load it
 */
for (i=2;i<process.argv.length;i++) {
	file = process.argv[i];
    const collectionName = path.basename(file).split('.').shift(); // Extract the file name and use it as the collection name
    if (mongoURI) {
        console.log("trying to load");
        loadFileToMongo(file, collectionName)
    } else {
	    loadFile(file);
    }
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
 * Function to load data from a CSV file into MongoDB
 */
async function loadFileToMongo(file, collectionName) {
    console.log(`${file} loading...`);
    const client = new MongoClient(mongoURI, { useUnifiedTopology: true });

    try {
        await client.connect();

        const db = client.db(mongoDB);
        const collection = db.collection(collectionName);

        // Clear existing data in the collection
        await collection.deleteMany({});

        await client.close();
    } catch (error) {
        console.error('Error:', error);
        client.close(); // Close the connection in case of an error
        console.log('Connection closed due to error');
    }

    try {
        await client.connect();

        const db = client.db(mongoDB);
        const collection = db.collection(collectionName);

        const stream = fs.createReadStream(file);

        const csvStream = await fastcsv.parse({ headers: true })
            .on('data', async (data) => {
                // Insert each CSV row as a document into the MongoDB collection
                await collection.insertOne(data);
            })
            .on('end', async () => {
                console.log(`${file} loaded to MongoDB`);
            });

        stream.pipe(csvStream);
    } catch (error) {
        console.error('Error:', error);
        client.close(); // Close the connection in case of an error
        console.log('Connection closed due to error');
    }
}

/*
 * Function to query data from MongoDB
 */
async function queryDataFromMongo(prefix, filter) {
    const client = new MongoClient(mongoURI);

    try {
        await client.connect();

        const db = client.db(mongoDB);
        const collection = db.collection(prefix);

        // Perform the query based on the filter
        const result = await collection.find(filter).toArray();

        return result;
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}


/*
 * Function to handle the users REST request
 */
async function handleRequest(req,res) {
    // Get the path they have asked for and the file type.
    prefix = req.params["prefix"];
    heading = req.params["column_heading"];
    value = req.params["value"];
    id = req.params["id"];

    // Also manage query parameters at the same time
    filter = req.query;
    if (heading) {
        filter[heading] = value;
    }

    // Protect the user from a massive file download!
    if (prefix == "LFB" && Object.keys(filter).length === 0) {
        res.status(400).send('This dataset is too large to serve all of it in one request');
    }
    let result = {};

    if (mongoURI) {
        if (id) {
            try {
                filter["_id"] = new ObjectId(id);
            } catch (err) {
                console.error("Invalid ObjectId:", err);
            }
        }
        result = await queryDataFromMongo(prefix, filter);
    } else {
        // Filter the data according to the request to only contain relevant rows
        result = database[prefix];
        result = result.filter(function(item) {
        for(var key in filter) {
            if(item[key] === undefined || item[key] != filter[key])
                return false;
            }
            return true;
        });
    }

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
app.get('/:prefix', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/:id.:ext', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/:id', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/:column_heading/:value.:ext', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/:column_heading/:value', function(req,res) { handleRequest(req,res); });

/*
 * Start the app!
 */
app.listen(port, () => console.log('App listening on port ' + port));
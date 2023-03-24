const getCSV = require('get-csv'); // Library required to load the csv
const express = require('express'); // Library than creates and manages REST requests
const ejs = require('ejs'); // Library to render HTML pages for web browsers
var json2csv = require('json2csv'); // Library to create CSV for output
var fs = require('fs');

const app = express(); // Initialise the REST app

var rows = []; // Create an array to store the rows from our CSV data
var metadata = {};
var context = {};
var schema = {};
var ld = {};

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
    path = process.argv[i];
    if (fs.lstatSync(path).isDirectory()) {
        loadDirectory(path);
    } else {
	   loadFile(path);
    }
}

/*
 * Load file from a directory
 */
function loadDirectory(path) {
    var metadataFile = path + "/metadata.csv";
    var dataFile = path + "/data.csv";
    var schemaFile = path + "/schema.csv";
    if (fs.existsSync(metadataFile)) {
        loadMetadata(metadataFile);
    }
    if (fs.existsSync(dataFile)) {
        loadFile(dataFile);
    }
    if (fs.existsSync(schemaFile)) {
        loadSchema(schemaFile);
    }
    setTimeout(function() {
        constructLD();
    },1000);
}

function constructLD() {
    ld = metadata;
    ld["@context"] = context;
    ld["@graph"] = [];
    for (const property in schema) {
     var object = {};
     object["@id"] = property;
     for (var i=0;i<schema[property].length;i++) {
        key = Object.keys(schema[property][i])[0];
        value = schema[property][i][key];
        if (value.substring(0,4) == "http") {
            object["jsonSchema:"+key] = { "@id": value };
        } else {
            object["jsonSchema:"+key] = value;
        }
     }
     ld["@graph"].push(object);
    }
    rows.forEach(function(row) {
        for(const key in row) {
            if(key.substring(0,1) == "$") {
                row[key.substring(1)] = context["@base"] + key.substring(1) + "/" + row[key];
                delete row[key];
            }
        }
    });
}   

/*
 * Load the metadata
 */
function loadMetadata(file) {
    console.log(file + " loading metadata");
    getCSV(file,function(err,data) {
        data.forEach(function(item) {
            if (item.key.substring(0,1) == "$") {
                if (item.key == "$base" || item.key == "$vocab") {
                    item.key = "@" + item.key.substring(1);
                } else {
                    item.key = item.key.substring(1);
                }
                context[item.key] = item.value;    
            } else if (item.value.substring(0,4) == "http") {
                metadata[item.key] = { "@id": item.value };
            } else {
                metadata[item.key] = item.value;
            }
        });
    });
}

/*
 * Load the schema
 */
function loadSchema(file) {
    console.log(file + " loading schema");
    getCSV(file,function(err,data) {
        data.forEach(function(item) {
            var object = {};
            object[item.key] = item.value;
            if (!schema[item.property]) {
                schema[item.property] = [];
            }
            schema[item.property].push(object);
        });
    });
}

/*
 * The function that loads the file into our rows object
 */
function loadFile(file) {
	console.log(file + " loading...");
	getCSV(file, function(err,data) {
	    rows = rows.concat(data);
	    console.log(file + " loaded");
	});
}

/* 
 * Function to handle the users REST request
 */
function handleRequest(req,res) {
    // Get the path they have asked for and the file type.
    heading = req.params["column_heading"];
    value = req.params["value"];

    // Also manage query parameters at the same time
    filter = req.query;
    if (heading) {
        filter[heading] = value;
    }
    for(var key in filter) {
        /* Massive hack */
        if (key == "id") {
            value = filter["id"];
            filter[key] = context["@base"] + "id/" + value;
        }
        if (key == "type") {
            value = filter["type"];
            filter["rdf:type"] = "schema:" + value;
            delete filter[key];
        }
        if (key == "addressRegion") {
            value = filter["addressRegion"];
            filter["schema:addressRegion"] = "http://dbpedia.org/resource/" + value;
            delete filter[key];
        }
        if (key == "name") {
            value = filter["name"];
            filter["foaf:name"] = value;
            delete filter[key];
        }
    }
    // Filter the data according to the request to only contain relevant rows
    result = rows;
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
        ext = req.accepts(['jsonld','json','csv','html']);
        if (req.get("Accept") == "application/ld+json" ) {
            ext = "jsonld";
        }
        if (req.get("Accept") == "application/json" ) {
            ext = "json";
        }
        if (req.get("Accept") == "text/csv" ) {
            ext = "csv";
        }
    }

    // Return the data to the user in a format they asked for
    // CSV, JSON or by default HTML (web page)
    if (ext == "csv") {
        res.set('Content-Type', 'text/csv');
        res.send(json2csv({ data: result }));
    } else if (ext == "json") {
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(result,null,4));
    } else if (ext == "jsonld") {
        res.set('Content-Type', 'application/ld+json');
        var toSend = JSON.parse(JSON.stringify(ld));
        result.forEach(function(item) {
            output = {};
            for (const property in item) {
                key = property;
                value = item[property];
                if (key.substring(0,1) == "$") {
                    key = "@" + key.substring(1);
                    value = ld["@context"]["@base"] + value;
                    output[key] = value;
                } else if (value.substring(0,4) == "http" || value.indexOf(":") > 0) {
                    output[key] = { "@id" : value }
                } else {
                    output[key] = value;
                }
            }
            toSend["@graph"].push(output);    
        });
        res.send(JSON.stringify(toSend,null,4));
    } else {
        ejs.renderFile(__dirname + '/page.html', { path: req.path, query: req.query }, function(err,data) {
            res.send(data);
        });
    }
};

/*
 * Set the available REST endpoints and how to handle them
 */
/*
app.get('/', function(req,res) { handleRequest(req,res); });
app.get('/:column_heading/:value.:ext', function(req,res) { handleRequest(req,res); });
app.get('/:column_heading/:value', function(req,res) { handleRequest(req,res); });
*/
app.get('/', function(req,res) { res.redirect(301,'https://learndata.info'); });
app.get('/:prefix', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/:column_heading/:value.:ext', function(req,res) { handleRequest(req,res); });
app.get('/:prefix/:column_heading/:value', function(req,res) { handleRequest(req,res); });

/*
 * Start the app!
 */
app.listen(3000, () => console.log('Example app listening on port 3000!'));
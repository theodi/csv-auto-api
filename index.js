const getCSV = require('get-csv');
const express = require('express');
var json2csv = require('json2csv');
const app = express();
var rows = [];

if (process.argv.length < 3) {
	console.log('No input files specified!');
	process.exit();
}

for (i=2;i<process.argv.length;i++) {
	file = process.argv[i];
	loadFile(file);
}

function loadFile(file) {
	console.log(file + " loading...");
	getCSV(file, function(err,data) {
	    rows = rows.concat(data);
	    console.log(file + " loaded");
	});
}

function handleRequest(req,res) {
    heading = req.params["column_heading"];
    value = req.params["value"];
    ext = req.params["ext"];
    var result = rows.filter( function (a) {
        return (a[heading] == value); 
    });
    if (ext == "csv" || (req.accepts('text/csv') && !ext)) {
        res.set('Content-Type', 'text/csv');
        res.send(json2csv({ data: result }));
    } else {
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(result,null,4));
    }
};

app.get('/', (req, res) => res.send(JSON.stringify(rows, null, 4)));
app.get('/:column_heading/:value.:ext', function(req,res) { handleRequest(req,res); });
app.get('/:column_heading/:value', function(req,res) { handleRequest(req,res); });

app.listen(3000, () => console.log('Example app listening on port 3000!'));

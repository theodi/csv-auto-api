const getCSV = require('get-csv');
const express = require('express');
var json2csv = require('json2csv');
const app = express();
var rows;

getCSV('http://training.theodi.org/ods/course/en/exercises/RailReferences.csv', function(err,data) {
    rows=data;
    console.log("Data loaded");
});

function handleRequest(req,res) {
    heading = req.params["column_heading"];
    value = req.params["value"];
    ext = req.params["ext"];
    var result = rows.filter( function (a) {
        return (a[heading] == value); 
    });
    if (ext == "csv" || req.accepts('text/csv')) {
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

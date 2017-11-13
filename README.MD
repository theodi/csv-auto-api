# CSV-AUTO-API

Takes a csv file and creates a simple REST API for it in nodejs.

Think of this like a single filter on the top of an excel sheet.

The REST API works as follows:

http://{home_url}/{column_title}/{search_value}

It can return result/s as CSV or JSON and you can use extensions (.csv & .json) or content negotiation (text/csv & application/json)

This version uses a subset of the NAPTAN data from data.gov.uk. This is the rail references file which gives you railway station data.

You can query it in the following ways:

http://{home_url}/CrsCode/PNZ
http://{home_url}/RevisionNumber/3

# Installing you own

1) Clone this repository

2) npm install 

3) node index.js

# RunKit Example

https://runkit.com/davetaz/5a09d2e172a5510012d2c4d1

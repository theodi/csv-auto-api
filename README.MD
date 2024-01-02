# CSV-AUTO-API

Takes a csv file and creates a simple REST API for it in nodejs.

Think of this like a single filter on the top of an excel sheet.

The REST API works as follows:

http://{home_url}/{file_prefix}/{column_title}/{search_value}

Note: The {file_prefix} is the name of the CSV file, e.g. if your file is called data.csv then the prefix will be "data".

It can return result/s as CSV or JSON and you can use extensions (.csv & .json) or content negotiation (text/csv & application/json)

You can also perform queries using a query API e.g.

http://{home_url}/{file_prefix}/?{column_title}={search_value}

and to add to the confusion you can also mix the two techniques

http://{home_url}/{file_prefix}/{column_title}/{search_value}?{column_title2}={search_value2}

# Installing your own

1) Clone this repository

2) npm install

3) node index.js file1.csv http://example.org/file2.csv ... ...

# Using a database to handle big files

If you have big data files then this will take up memory, so consider using a mongo database. You can configure the app to use this by creating a config.env file like the example one in config.env.example

The other advantage of this is that if you don't specify an input file then it will still try and load from the collection in the database without reloading. If you wish to update the collection, reload the file and it will overwrite.
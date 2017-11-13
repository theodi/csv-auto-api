=CSV-AUTO-API

Takes a csv file and creates a simple REST API for it in nodejs.

Think of this like a single filter on the top of an excel sheet.

The REST API works as follows:

http://{home_url}/{column_title}/{search_value}

It can return result/s as CSV or JSON and you can use extensions (.csv & .json) or content negotiation (text/csv & application/json)

I'll put an example here in a bit

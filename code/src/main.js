// store main element for later
const visElement = d3.select('#vis');

/**
 * Load sample data and update a table
 */
d3.csv('data/sample.csv')
    .then((data) => { // wait until loading has finished, then ...
        const table = createTable(data.columns);
        updateTableRows(table, data);
    })
    .catch((error) => {
        console.error('Error loading the data', error);
    });

/**
 * Create a table with the given columns as table header
 * @param {string[]} columns Array with the column names
 */
function createTable(columns) {
    const table = visElement.append('table');
    table.html(`<thead></thead><tbody></tbody>`);

    const tableHead = table.select('thead').append('tr');

    // add a table head cell for each item in the column array
    tableHead.selectAll('th')
        .data(columns)
        .join('th')
        .text((d) => d);

    return table;
}

/**
 * Add new table rows for the given data
 * @param {d3.select} table D3 selection of the table element
 * @param {array} data Loaded data as array
 */
function updateTableRows(table, data) {
    // add a table row for each item in the dataset
    const tr = table.select('tbody')
        .selectAll('tr')
        .data(data, (d) => d.fruit) // use the property `fruit` as unique key
        .join('tr');
        // ... add further tr attributes and css classes

    tr.selectAll('td') // add a table cell for each property (i.e., column) in an item
        .data((d) => Object.values(d)) // `Object.values(d)` returns all property values of `d` as array
        .join('td')
        .text((d) => d);
}

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

d3.json("src/bezirke_95_topo.json")
    .then(topology => {
        createMap(topology);
    })
    .catch(error => {
        console.error('Error loading the topology data', error);
    });

function createMap(topology) {
    const width = 900;
    const height = 600;

    const geoData = topojson.feature(topology, {
        type: "GeometryCollection",
        geometries: topology.objects.bezirke.geometries
    });

    const projection = d3.geoMercator()
        .fitSize([width, height], geoData);

    const path = d3.geoPath()
        .projection(projection);

    const color = d3.scaleQuantize([401, 418], d3.schemeReds[6])

    const svg = d3.select('#map')
        .attr('height', height)
        .attr('width', width);

    svg.append("g")
        .selectAll('.county')
        .data(geoData.features)
        .enter()
        .append('path')
        .classed('.county', true)
        .attr("fill", d => color(Number(d.properties.iso))) // TODO: add proper coloring metric (https://observablehq.com/@d3/state-choropleth)
        .attr('d', path);

    svg.append('path')
        .datum(topojson.mesh(topology, topology.objects.bezirke, (a, b) => a !== b ))
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .attr("d", path);
}

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

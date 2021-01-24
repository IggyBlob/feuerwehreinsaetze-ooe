// store main element for later
const visElement = d3.select('#vis');

const state = {
    alarmsData: [],
    brigadesData: [],
    month: 1
};

function parseDate(dateString) {
    return moment(dateString, "dd.MM.YYYY HH:mm", "Europe/Vienna");
}

const districtPromise = d3.json("data/bezirke_95_topo.json")
    .then(topology => {
        createMap(topology);
    })
    .catch(error => {
        console.error('Error loading the topology data', error);
    });

const alarmsPromise = d3.dsv(";", "data/alarms-splitted.csv")
    .then(parsed => {
        state.alarmsData = parsed.map(row => {
            row.alarmId = parseInt(row.alarmId);
            row.districtNo = parseInt(row.districtNo);
            row.alarmLevel = parseInt(row.alarmLevel)
            row.brigadeCount = parseInt(row.brigadeCount)
            row.latitude = parseFloat(row.latitude)
            row.longitude = parseFloat(row.longitude)
            row.alarmStart = parseDate(row.alarmStart);
            row.alarmEnd = parseDate(row.alarmEnd);

            return row;
        });
    })
    .catch(error => {
        console.error('Error loading the alarms data', error);
    });

const brigadePromise = d3.dsv(";", "data/brigades-splitted.csv")
    .then(parsed => {
        state.brigadesData = parsed.map(row => {
            row.brigadeId = parseInt(row.brigadeId);
            row.callStart = parseDate(row.callStart);
            row.callEnd = parseDate(row.callEnd);

            return row;
        });
    })
    .catch(error => {
        console.error('Error loading the brigades data', error);
    });

Promise.all([districtPromise, alarmsPromise, brigadePromise])
    .then(_ => updateApp());

d3.select("#month").on("change", function () {
    state.month = parseInt(d3.select(this).property("value"));
    updateApp();
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
        .datum(topojson.mesh(topology, topology.objects.bezirke, (a, b) => a !== b))
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .attr("d", path);
}

function updateApp() {
    const filteredAlarms = filterAlarmsData();
    const filteredBrigades = filterBrigadesData();
    console.log("asdf");
}

function filterAlarmsData() {
    return state.alarmsData.filter(alarm => {
      return alarm.alarmStart.month() + 1 === state.month
    });
}

function filterBrigadesData() {
    return state.brigadesData.filter(brigade => {
        return brigade.callStart.month() + 1 === state.month
    });
}

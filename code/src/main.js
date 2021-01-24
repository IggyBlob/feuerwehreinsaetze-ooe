// store main element for later
const mapElement = d3.select('#map');

const state = {
    topology: [],
    alarmsData: [],
    brigadesData: [],
    month: 1
};

function parseDate(dateString) {
    return moment(dateString, "dd.MM.YYYY HH:mm", "Europe/Vienna");
}

const districtPromise = d3.json("data/bezirke_95_topo.json")
    .then(topology => {
        state.topology = topology;
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

function createMap(filteredAlarms) {
    // remove existing paths
    mapElement.selectAll("g").remove();

    let groupedAlarms = groupAlarmsByDistrict(filteredAlarms);

    let topology = state.topology;

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

    const color = d3.scaleLinear()
        .domain([Math.min(...groupedAlarms.values()), Math.max(...groupedAlarms.values())])
        .range(["#fee5d9", "#a50f15"]);

    const svg = mapElement
        .attr('height', height)
        .attr('width', width);

    svg.append("g")
        .selectAll('.county')
        .data(geoData.features)
        .enter()
        .append('path')
        .classed('.county', true)
        .attr("fill", d => color(Number(groupedAlarms.get(d.properties.name))))
        .attr('d', path);

    svg.append('path')
        .datum(topojson.mesh(topology, topology.objects.bezirke, (a, b) => a !== b))
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .attr("d", path);
}

function groupAlarmsByDistrict(alarms) {
    const map = new Map();
    alarms.forEach(item => {
        const key = item.district;
        const value = map.get(key);
        if (!value) {
            map.set(key, 1);
        } else {
            map.set(key, value + 1);
        }
    });
    return map;
}

function updateApp() {
    const filteredAlarms = filterAlarmsData();
    const filteredBrigades = filterBrigadesData();

    createMap(filteredAlarms);
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

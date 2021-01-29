// store main element for later
const mapElement = d3.select('#map');

// store tooltip element
const tooltip = d3.select('#tooltip');

const state = {
    topology: [],
    alarmsData: [],
    brigadesData: [],
    month: 1,
    district: undefined
};

function parseDate(dateString) {
    return moment(dateString, "DD.MM.YYYY HH:mm", "Europe/Vienna");
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

const chartMode = {
    bar: 1,
    line: 2
};

const alarmTypeBarChart = createChart("#alarmTypeBarChart", chartMode.bar);
const mostActiveBrigadesBarChart = createChart("#mostActiveBrigadesBarChart", chartMode.bar);
const averageCallDurationBarChart = createChart("#averageCallDurationBarChart", chartMode.bar);
const alarmsPerDayLineChart = createChart("#alarmsPerDayLineChart", chartMode.line);

function createMap(filteredAlarms) {

    function calcMinMaxOfDistrictGrouping(groupedAlarms) {
        let min = Number.MAX_VALUE;
        let max = Number.MIN_VALUE;

        for (const [_, value] of groupedAlarms) {
            min = Math.min(min, value.length);
            max = Math.max(max, value.length);
        }

        min = groupedAlarms.size > 1 ? min : 0;
        return {min, max};
    }

    // remove existing paths
    mapElement.selectAll("g").remove();
    // remove existing pins
    mapElement.selectAll(".pin").remove();

    let groupedAlarms = groupAlarmsByDistrict(filteredAlarms);
    const {min, max} = calcMinMaxOfDistrictGrouping(groupedAlarms);

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

    // define linear red color scale
    const color = d3.scaleLinear()
        .domain([min, max])
        .range(["#fee5d9", "#a50f15"]);

    const svg = mapElement
        .attr('height', height)
        .attr('width', width);

    // draw map and colorize districts
    svg.append("g")
        .selectAll('.district')
        .data(geoData.features)
        .enter()
        .append('path')
        .classed('district', true)
        .attr("fill", d => {
            const alarmsOfDistrict = groupedAlarms.get(d.properties.name);
            return color(Number(alarmsOfDistrict ? alarmsOfDistrict.length : 0))
        })
        .attr('d', path)
        .on("click", (x, d) => {
            state.district = d.properties.name;
            updateApp();
        })
        .append('title')
        .text(d => {
            const districtAlarms = groupedAlarms.get(d.properties.name);
            return `${d.properties.name}${(districtAlarms) ? ": " + districtAlarms.length : ""}`;
        });

    // smoother corners
    svg.append('path')
        .datum(topojson.mesh(topology, topology.objects.bezirke, (a, b) => a !== b))
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-linejoin", "round")
        .attr("d", path);

    // draw pins of alarms
    svg.selectAll(".pin")
        .data(filteredAlarms)
        .enter()
        .append("circle")
        .classed('pin', true)
        .attr("fill", "#1c1c1c")
        .attr("r", 1.5)
        .attr("transform", (d) =>
            "translate(" + projection([
                d.longitude,
                d.latitude
            ]) + ")"
        );
}

function createChart(svgSelector, mode) {
    const margin = {
        top: 5,
        bottom: 200,
        left: 150,  // CAUTION: if modified, CSS must also be adapted
        right: 0,
    };
    const width = 500 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    // creates sources <svg> element
    const svg = d3
        .select(svgSelector)
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    // group used to enforce margin
    const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // scales setup
    let xscale;
    const yscale = d3.scaleLinear().range([height, margin.top]);
    if (mode === chartMode.bar) {
        xscale = d3.scaleBand().rangeRound([0, width]).paddingInner(0.1);
    } else if (mode === chartMode.line) {
        xscale = d3.scaleTime().range([0, width]);
    } else {
        throw "unknown chart mode";
    }

    // axis setup
    const xaxis = d3.axisBottom().scale(xscale);
    const g_xaxis = g.append("g").attr("class", "x axis").attr("transform", `translate(0,${height})`);
    const yaxis = d3.axisLeft().scale(yscale);
    const g_yaxis = g.append("g").attr("class", "y axis");

    if (mode === chartMode.line) {
        const timeFormat = d3.timeFormat("%d");
        xaxis.tickFormat(timeFormat);
    }

    // return update functions depending on chart type
    if (mode === chartMode.bar) {
        function update_bar(new_data) {
            xscale.domain(new_data.map((d) => d.key));
            yscale.domain([0, d3.max(new_data, (d) => d.value)]);

            g_xaxis.transition().call(xaxis);
            g_yaxis.transition().call(yaxis);

            const rect = g
                .selectAll("rect")
                .data(new_data, (d) => d.key)
                .join(
                    (enter) => {
                        const rect_enter = enter.append("rect").attr("y", height);
                        rect_enter.append("title");
                        return rect_enter;
                    },
                    (update) => update,
                    (exit) => exit.remove()
                );

            rect.transition()
                .attr("x", (d) => xscale(d.key))
                .attr("y", d => yscale(d.value))
                .attr("height", d => yscale(0) - yscale(d.value))
                .attr("width", xscale.bandwidth());

            rect.select("title")
                .text((d) => `${d.key}: ${d.value}`);

            // rotate x-axis labels by 45deg
            svg.selectAll("g.x.axis g text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");
        }

        return update_bar;
    } else if (mode === chartMode.line) {
        const tooltipLine = g.append("line");
        const tipBox = g
            .append("rect")
            .attr("class", ".tipbox")
            .attr('width', width)
            .attr('height', height)
            .attr('opacity', 0);

        function update_line(new_data) {
            tipBox
                .on('mousemove', drawTooltip)
                .on('mouseleave', removeTooltip);

            function drawTooltip(event) {
                const date = moment(xscale.invert(d3.pointer(event, tipBox.node())[0])).startOf("day");
                const alarmsValue = new_data.find(elem => elem.key === date.toISOString());

                tooltipLine.attr('stroke', 'black')
                    .attr('x1', xscale(date))
                    .attr('x2', xscale(date))
                    .attr('y1', 0)
                    .attr('y2', height);

                tooltip.html(`${date.format("DD.MM.YYYY")}: ${alarmsValue.value}`)
                    .style('display', 'block')
                    .style('left', event.pageX + 20 + 'px')
                    .style('top', event.pageY - 20 + 'px');
            }

            function removeTooltip() {
                tooltipLine.attr("stroke", "none");
                tooltip.style("display", "none");
            }

            xscale.domain(d3.extent(new_data, (d) => moment(d.key)));
            yscale.domain([0, d3.max(new_data, (d) => d.value)]);

            g_xaxis.transition().call(xaxis);
            g_yaxis.transition().call(yaxis);

            const line = d3.line()
                .x(d => xscale(moment(d.key)))
                .y(d => yscale(d.value));

            const linesContainer = g
                .selectAll(".line")
                .data([new_data], (d) => moment(d.key));

            const lines = linesContainer
                .join(
                    (enter) => enter.append("path")
                        .classed("line", true)
                        // enter must return a selection, otherwise d3 will throw an error
                        // https://github.com/d3/d3-selection/issues/207
                        .call(enter =>
                            enter
                                .merge(linesContainer)
                                .transition()
                                .attr("d", line)),
                    (update) => update,
                    (exit) => exit.remove()
                );

            // rotate x-axis labels by 45deg
            svg.selectAll("g.x.axis g text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-45)");

            // raise tooltip elements to the front of the svg
            tooltipLine.raise();
            tipBox.raise();
        }

        return update_line;
    } else {
        throw "unknown chart mode";
    }
}

function groupAlarmsByDistrict(alarms) {
    const map = new Map();
    alarms.forEach(item => {
        const key = item.district;
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item)
        }
    });
    return map;
}

function updateApp() {
    const filteredAlarms = filterAlarmsData();
    const filteredBrigades = filterBrigadesData(filteredAlarms);

    const topAlarmTypes = groupByKey(filteredAlarms, a => a.alarmType, 10, true);
    const mostActiveBrigades = groupByKey(filteredBrigades, b => b.name, 10, true);
    const avgCallDuration = groupAverageCallDurationByAlarmType(filteredAlarms, 20, true);
    const alarmsPerDay = groupByKey(filteredAlarms, a => a.alarmStart.startOf("day").toISOString(), 31, false);

    document.getElementById("district").innerHTML = state.district ? state.district : "alle";
    document.getElementById("resetDistrictLink").style.display = state.district ? "inline-block" : "none";

    createMap(filteredAlarms);
    alarmTypeBarChart(topAlarmTypes);
    mostActiveBrigadesBarChart(mostActiveBrigades);
    averageCallDurationBarChart(avgCallDuration);
    alarmsPerDayLineChart(alarmsPerDay);
}

function filterAlarmsData() {
    return state.alarmsData
        .filter(alarm => alarm.alarmStart.month() + 1 === state.month)
        .filter(alarm => state.district ? alarm.district === state.district : true);
}

function filterBrigadesData(alarms) {
    return state.brigadesData
        .filter(brigade => brigade.callStart.month() + 1 === state.month)
        .filter(brigade => state.district ? alarms.some(a => a.alarmNr === brigade.alarmNr) : true);
}

function groupByKey(items, keyExtractor, n, sortByValue) {
    const unorderedMap = new Map();
    items.forEach(item => {
        const key = keyExtractor(item);
        const value = unorderedMap.get(key);
        unorderedMap.set(key, value ? value + 1 : 1);
    });
    return [...unorderedMap]
        .sort((a, b) => (sortByValue) ? b[1] - a[1] : 1)
        .slice(0, n)
        .map(a => {
            return {key: a[0], value: a[1]}
        });
}

function groupAverageCallDurationByAlarmType(alarms, n) {
    const unorderedMap = new Map();
    alarms.forEach(alarm => {
        const key = alarm.alarmType;
        const value = unorderedMap.get(key) || Object.assign({}, {count: 0, sum: 0.0});
        value.count += 1;
        value.sum += alarm.alarmEnd.diff(alarm.alarmStart, 'minutes'); // momentJS
        unorderedMap.set(key, value);
    });
    return [...unorderedMap]
        .map(e => {
            return {key: e[0], value: e[1].sum / e[1].count / 60}
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, n);
}

function resetDistrict() {
    state.district = undefined;
    updateApp();
}

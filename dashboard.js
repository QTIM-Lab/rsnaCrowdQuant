
// iffy wrapper
(function() {

const baseURL='http://rsnacrowdquant2.eastus2.cloudapp.azure.com:5984';
const measurementsURL = baseURL + '/measurements';
const measurementsDB = new PouchDB(measurementsURL);
const chronicleURL = baseURL + '/chronicle';
const chronicleDB = new PouchDB(chronicleURL);

const catToLabel =  {
    'TCGA-LUAD' : 'Lung',
    'TCGA-LIHC' : 'Liver',
    'TCGA_RN' : 'Renal',
    'TCGA_OV' : 'Ovarian'
};
const seriesCategories = Object.keys(catToLabel);

document.addEventListener("DOMContentLoaded", function(e) {

    Promise.all([
        measurementsDB.query('by/annotators', {
            reduce: true,
            group: true,
            level: 'exact',
        }),
        measurementsDB.query('by/seriesUID', {
            reduce: true,
            group: true,
            level: 'exact'
        }),
        chronicleDB.query('instances/bySeriesUID', {
            reduce: true,
            group: true,
            level: 'exact'
        }),
        measurementsDB.allDocs({
          include_docs: true
        }),
    ])
    .then (function(res) {

        var measByAnno = res[0].rows;
        var measBySeries = res[1].rows;
        var seriesInfo = res[2].rows;
        var allMeas = res[3].rows;

        measByAnno.sort(function(a, b) { return b.value - a.value; });
        measBySeries.sort(function(a, b) { return b.value - a.value; });

        var seriesToCat = seriesInfo.reduce(function(a, c) {
            a[c.key[0]] = c.key[1];
            return a;
        }, {});

        let annotatorToAnnotations = {};
        allMeas.forEach(function (m) {
            if (!annotatorToAnnotations[m.doc.annotator]) {
                annotatorToAnnotations[m.doc.annotator] = [];
            }

            annotatorToAnnotations[m.doc.annotator].push(m.doc);
        })

        populateLeaderBoard(measByAnno, annotatorToAnnotations, seriesToCat);
        populateAnnotationPerCategory(measBySeries, seriesToCat);
        populateHistogram(measBySeries);

    });

});


function populateAnnotationPerCategory(measBySeries, catBySeriesMap) {

    var svg = d3.select('#annos-by-category');

    var catMap = {};
    measBySeries.forEach(function(m) {
        m.category = catBySeriesMap[m.key];
        if (!catMap[m.category]) {
            catMap[m.category] = 0;
        }
        catMap[m.category]++;
    });

    var margin = {top: 60, right: 40, bottom: 30, left: 60},
        width = +svg.attr('width') - margin.left - margin.right,
        height = +svg.attr('height') - margin.top - margin.bottom;

    svg.append('g')
        .attr('transform', 'translate(40, 30)')
        .append('text')
        .text('Annotations per Category');

    var svgg = svg.append("g")
        .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleBand()
        .rangeRound([0, width])
        .paddingInner(0.1)
        .align(0.1);

    var y = d3.scaleLinear()
        .rangeRound([height, 0]);

    x.domain(Object.keys(catMap));
    y.domain([0, d3.max(Object.values(catMap))]).nice();

    svgg.selectAll(".bar")
      .data(d3.entries(catMap))
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) { return x(d.key); })
      .attr("width", x.bandwidth())
      .attr("y", function(d) { return y(d.value); })
      .attr("height", function(d) { return height - y(d.value); });

    svgg.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).tickSizeOuter(0).tickFormat(function(t) { return catToLabel[t];}))
        .select(".domain").remove();

    svgg.append("g")
        .attr("class", "y axis")
        .attr('transform', 'translate (' + (-10) + ', 0)')
        .call(d3.axisLeft(y).tickSize(-width-20));
}

function populateHistogram(rows) {

    var svg = d3.select('#annos-by-case-histogram');

    var data = rows.map(function(d) { return d.value; });

    var margin = {top: 20, right: 20, bottom: 30, left: 50},
        width = +svg.attr('width') - margin.left - margin.right,
        height = +svg.attr('height') - margin.top - margin.bottom;

    // set the ranges
    var x = d3.scaleLinear()
              .range([0, width]);
              //.padding(0.1);

    var y = d3.scaleLinear()
              .range([height, 0]);

    var svgg = svg.append("g")
        .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");

    // Scale the range of the data in the domains
    x.domain([0, data.length]);
    y.domain([0, d3.max(data)]).nice();

    // append the rectangles for the bar chart
    svgg.selectAll(".bar")
      .data(data)
    .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d, i) { return x(i); })
      .attr("width", 2)
      .attr("y", function(d) { return y(d); })
      .attr("height", function(d) { return height - y(d); });

      // add the x Axis
      var axisBuffer = 10;
      svgg.append("g")
          .attr("transform", "translate(0," + (height + axisBuffer) + ")")
          .call(d3.axisBottom(x));

      // // add the y Axis
      svgg.append("g")
          .attr('transform', 'translate (' + (-axisBuffer) + ', 0)')
          .call(d3.axisLeft(y));
}

// redundant input data
function populateLeaderBoard(measByAnno, annotatorToAnnotations, seriesToCat) {

    d3.select('.leaderboard .annotator-count')
            .text(measByAnno.length);

    displayTopAnnotators(measByAnno, 20);

    let annoToCatToCt = arrangeAnnoData(annotatorToAnnotations, seriesToCat);
    populateAnnotationsPerAnnotator(annoToCatToCt);
}

// simplify data to map of annotator to map of category id to count
// { <annotator> : { <catId>: <int> }}
function arrangeAnnoData(annotatorToAnnotations, seriesToCat) {
    let ret = {};
    let annotators = Object.keys(annotatorToAnnotations);

    annotators.forEach(a => ret[a] = {
        annotator: a,
        'TCGA-LIHC': 0, // better would be to loop through categories
        'TCGA-LUAD': 0,
        'TCGA_OV': 0,
        'TCGA_RN': 0,
        'total': 0
    });

    annotators.forEach(a => {
        annotatorToAnnotations[a].forEach (an => {
            let cat = seriesToCat[an.seriesUID];
            ret[a][cat]++;
            ret[a]['total']++;
        });
    });

    return ret;
}

function populateAnnotationsPerAnnotator(annoToCatToCt) {
    var svg = d3.select('#aba-chart'),
        margin = {top: 20, right: 20, bottom: 30, left: 40},
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom,
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleBand()
        .rangeRound([0, width+20])
        //.paddingInner(0.05)
        .align(0.1)
        ;

    var y = d3.scaleLinear()
        .rangeRound([height, 0]);

    var z = d3.scaleOrdinal()
        .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);

    var data = Object.keys(annoToCatToCt).map(function (a) { return annoToCatToCt[a]; });

    data = data.filter(d => d.total > 0);
    data.sort(function(a, b) { return b.total - a.total; });

    x.domain(data.map(d => d.annotator));
    y.domain([0, d3.max(data, function(d) { return d.total; })]).nice();
    z.domain(seriesCategories);

    let stack = d3.stack()
        .keys(seriesCategories);

    let newData = stack(data);

    g.append("g")
        .selectAll("g")
            .data(newData)
          .enter().append("g")
            .attr("fill", function(d) { return z(d.key); })
            .selectAll("rect")
                .data(function(d) { return d; })
              .enter().append("rect")
                .attr("x", function(d) { return x(d.data.annotator); })
                .attr("y", function(d) { return y(d[1]); })
                .attr("height", function(d) { return y(d[0]) - y(d[1]); })
                .attr("width", x.bandwidth())
                .on("mouseover", function() { tooltip.style("display", null); })
                .on("mouseout", function() { tooltip.style("display", "none"); })
                .on("mousemove", function(d) {
                    var xPosition = d3.mouse(this)[0];
                    var yPosition = d3.mouse(this)[1];
                    tooltip.attr("transform", "translate(" + xPosition + "," + yPosition + ")");
                    tooltip.select("text").text(d.data.annotator);
                });

        var tooltip = svg.append("g")
          .attr("class", "tooltip")
          .style("display", "none");

        tooltip.append("text")
          .attr("x", 15)
          .attr("dy", "1.2em")
          .style("text-anchor", "start")
          .attr("font-size", "12px")
          .attr("font-weight", "bold");
    // g.append("g")
    //   .attr("class", "axis")
    //   .attr("transform", "translate(0," + height + ")")
    //   .call(d3.axisBottom(x));

    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(null, "s"))
    .append("text")
      .attr("x", 2)
      .attr("y", y(y.ticks().pop()) + 0.5)
      .attr("dy", "0.32em")
      .attr("fill", "#000")
      .attr("font-weight", "bold")
      .attr("text-anchor", "start")
      .text("Annotation Count");

  var legend = g.append("g")
      .attr("font-family", "sans-serif")
      .attr("font-size", 10)
      .attr("text-anchor", "end")
    .selectAll("g")
    .data(seriesCategories.slice().reverse())
    .enter().append("g")
      .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

  legend.append("rect")
      .attr("x", width - 19)
      .attr("width", 19)
      .attr("height", 19)
      .attr("fill", z);

  legend.append("text")
      .attr("x", width - 24)
      .attr("y", 9.5)
      .attr("dy", "0.32em")
      .text(function(d) { return d; });
}

function displayTopAnnotators(rows, numToDisplay) {

    var topAnnotators = d3.select('.top-annotators');

    var annotatorContainers = topAnnotators.selectAll('.annotator')
        .data(rows)
      .enter()
      .filter(function(d, i) { return i < numToDisplay; })
        .append('div')
        .classed('annotator', true);

    annotatorContainers
        .append('text')
        .text(function(d) {
            return d.key ? d.key : '< null >';
        });

    annotatorContainers
        .append('text')
        .text(function(d){
            return d.value;
        });
}


})(); // end iffy

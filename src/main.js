var d3 = Object.assign({},
  require("d3-selection"),
  require("d3-transition"),
  require("d3-time-format"),
  require("d3-collection"),
  require("d3-scale"),
  require("d3-array"),
  require("d3-shape"),
  require("d3-axis"),
);

var dateFormat = require('date-fns/format');
var colours = require('./modules/chart-colours.js');
var transform = require('./modules/data-transform.js');
var fuelTechIds = require('./modules/fuel-tech-ids.js');
var fuelTechLabels = require('./modules/fuel-tech-labels.js');

// date format
var formatTime = d3.timeFormat("%e %b, %H:%M");

var legendTable = document.getElementById("legend-table");
legendTable.style.display = 'none';
document.getElementById("legend-toggle").onclick = function() {
  var currentDisplay = legendTable.style.display;
  if (currentDisplay === 'none') {
    legendTable.style.display = 'block';
  } else {
    legendTable.style.display = 'none';
  }
}

var timeout = false, // holder for timeout id
    delay = 250, // delay after event is "complete" to run callback
    calls = 0;

// window.resize callback function
function getWindowWidth() {
  console.log(window.innerWidth);
  console.log(window.innerHeight);
  calls += 1;
  console.log(calls);
  return window.innerWidth;
}

// window.resize event listener
window.addEventListener('resize', function() {
    // clear the timeout
  clearTimeout(timeout);
  // start timing for event "completion"
  timeout = setTimeout(getWindowWidth, delay);
});

var windowWidth = window.innerWidth > 600 ? 590 : window.innerWidth-10;


function responsivefy(svg) {
  // get container + svg aspect ratio
  var container = d3.select(svg.node().parentNode),
      width = parseInt(svg.style("width")),
      height = parseInt(svg.style("height")),
      aspect = width / height;

  // add viewBox and preserveAspectRatio properties,
  // and call resize so that svg resizes on inital page load
  // svg.attr("viewBox", "0 0 " + width + " " + height)
  //     .attr("preserveAspectRatio", "xMinYMid")
  //     .call(resize);

  // to register multiple listeners for same event type,
  // you need to add namespace, i.e., 'click.foo'
  // necessary if you call invoke this function for multiple svgs
  // api docs: https://github.com/mbostock/d3/wiki/Selections#on
  d3.select(window).on("resize." + container.attr("id"), resize);
  // get width of container and resize svg to fit it
  function resize() {
      var targetWidth = parseInt(container.style("width"));
      svg.attr("width", targetWidth);
      svg.attr("height", Math.round(targetWidth / aspect));
      // svg.attr("height", targetHeight);
  }
}

var margin = {top: 1, right: 2, bottom: 20, left: 2};
var width = windowWidth - margin.left - margin.right;
var height = 220 - margin.top - margin.bottom;

var svg = d3.select("#chart")
  .append("svg")
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  // .call(responsivefy);
  
var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// var parseTime = d3.timeParse("%d-%b-%y");

var x = d3.scaleTime()
  .rangeRound([0, width]);
var y = d3.scaleLinear()
  .rangeRound([height, 0]);

var z = d3.scaleOrdinal(colours);
var stack = d3.stack();

// var line = d3.line()
//   .x(function(d) { return x(d3.isoParse(d.date)); })
//   .y(function(d) { return y(d['nem.fuel_tech.wind.power']); });

var area = d3.area()
  .curve(d3.curveBasis)
  .x(function(d, i) { return x(d3.isoParse(d.data.key)); })
  .y0(function(d) { return y(d[0]); })
  .y1(function(d) { return y(d[1]); });

function redraw() {
  
}

fetch('https://data.opennem.org.au/power/nem.json')
  .then(function(response) {
    return response.json();
  })
  .then(function(myJson) {
    var newData = transform(myJson);
    var data = newData;

    var keys = Object.keys(data[0]);
    keys.shift(); // remove 'date'

    var coeff = 1000 * 60 * 30;
    var entries = d3.nest()
      .key(function(d) { return dateFormat(Math.round(new Date(d.date).getTime() / coeff) * coeff)})
      .rollup(function(a) {
        var obj = {};

        fuelTechIds.forEach(function(id) {
          obj[id] = d3.mean(a, function(d) { return d[id] });
        });
        
        return obj;
      })
      .entries(data);

    data = entries;
  
    x.domain(d3.extent(data, function(d) { return d3.isoParse(d.key); }));
    y.domain([0, 33000]);
    z.domain(keys);
    stack
      .keys(keys)
      .value(function value(d, key) {
        return d.value[key];
      });
    
    g.append("text")
      .attr("class", "title")
      .text('Generation MW')
      .attr("x", 0)
      .attr("y", 0)
      .attr("dy", "1.5em")
      .attr("dx", ".5em")
      .style("font-size", 10);

    var mouseGroup = g.append('g').attr('class', 'mouse-group');

    var layer = g.selectAll(".layer")
      .data(stack(entries))
      .enter().append("g")
        .attr("class", "layer");
    
        
    g.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(0," + height + ")")
      // .call(d3.axisBottom(x).ticks(7).tickSize(-height).tickFormat(d3.timeFormat("%_d %b")))
      .call(d3.axisBottom(x).ticks(3).tickSize(-height).tickFormat((function(d) {
        var currentHour = d.getHours();
        var currentMinute = d.getMinutes();
        var dayFormat = d3.timeFormat("%_d %b");
        var timeFormat = d3.timeFormat("%H:%M");
        var formatted = timeFormat(d);

        if (currentHour === 0 && currentMinute === 0) {
          formatted = dayFormat(d);
        }
        return formatted;
      })))
      .selectAll("text")
        .attr("y", 6)
        .attr("x", 6)
        .style("text-anchor", "start");
    
    g.append("g")
      .attr("class", "axis axis--y")
      .call(d3.axisLeft(y).ticks(4).tickSize(-width))
      .selectAll("text")
        .attr("y", -6)
        .attr("x", 6)
        .style("text-anchor", "start");

    mouseGroup.append('g')
      .append("path") // this is the black vertical line to follow mouse
      .attr("class", "mouse-line")
      .style("stroke", "#c74523")
      .style("stroke-width", "1px")
        
    var tooltip = mouseGroup.append("g")
      .attr("class", "tooltip")
      .style("opacity", "0");

    // tooltip.append("rect")
    //   .style("stroke", "red")
    //   .style("width", "30px")
    //   .style("height", "10px")
    //   .attr('fill', 'red')
    
    tooltip.append("text")
      .attr("class", "date")
      .text('')
      .attr("x", 0)
      .attr("y", 0)
      .attr("dy", "1.3em")
      .attr("dx", ".5em")
      .style("font-size", 10);

    var valueWrapper = tooltip.append("g")
      .attr("class", "value-wrapper")
    
    valueWrapper.append('rect')
      .style("width", width+"px")
      .style("height", "18px")
      .style("opacity", ".3")
      .attr('fill', '#999')
    
    valueWrapper.append("text")
      .attr("class", "value")
      .text('')
      .attr("x", width)
      .attr("y", 0)
      .attr("dy", "1.3em")
      .attr("dx", "-.5em")
      .style("text-anchor", "end")
      .style("font-size", 10);

    layer.append("path")
      .attr("class", "area")
      .style("fill", function(d) { return z(d.key); })
      .attr("d", area);
    
    layer.attr("opacity", 1)
      .on("mouseover", function(d, i) {
        // svg.selectAll(".layer").transition()
        //   .duration(10)
        //   .attr("opacity", function(d, j) {
        //     return j != i ? 0.6 : 1;
        // });
      
        d3.select(".title")
          .style("opacity", "0");

        svg.selectAll(".layer").transition()
          .duration(100)
          .attr("opacity", '.85');

        d3.select(".mouse-line")
          .style("opacity", "1");
        d3.select(".tooltip")
          .style("opacity", "1");
      })
      .on("mouseout", function(d, i) {
        d3.select(".title")
          .style("opacity", "1");
        svg.selectAll(".layer").transition()
          .duration(100)
          .attr("opacity", "1");
        d3.select(".mouse-line")
          .style("opacity", "0");
        d3.select(".tooltip")
          .style("opacity", "0");
      })
      .on('mousemove', function(d) { // mouse moving over canvas
        var mouse = d3.mouse(this);

        var bisectDate = d3.bisector(function(d) {
          return d3.isoParse(d.date);
        }).left;

        var xDate = x.invert(mouse[0]);
        var i = bisectDate(newData, xDate, 1);
        var d0 = newData[i - 1];
        var d1 = newData[i];
        var xDateData = xDate - d0.date > d1.date - xDate ? d1 : d0;
        var hoverFuelTech = d.key;

        d3.select('.tooltip .date').text(formatTime(d3.isoParse(xDateData.date)));
        d3.select('.tooltip .value').text(fuelTechLabels[hoverFuelTech] + ': ' + xDateData[hoverFuelTech] + ' MW')

        d3.select(".mouse-line")
          .attr("d", function() {
            var d = "M" + mouse[0] + "," + (height+10);
            d += " " + mouse[0] + "," + 18;
            return d;
          });
        
        // d3.select(".tooltip rect")
        //   .attr("x", function() {
        //     var x = mouse[0];
        //     if (x <= 15) x = 15;
        //     if (x >= width-15) x = width-15;
        //     return x;
        //   })
      })
  
    
    // layer.filter(function(d) { return d[d.length - 1][1] - d[d.length - 1][0] > 0.01; })
    //   .append("text")
    //     .attr("x", width - 6)
    //     .attr("y", function(d) { return y((d[d.length - 1][0] + d[d.length - 1][1]) / 2); })
    //     .attr("dy", ".35em")
    //     .style("font", "10px sans-serif")
    //     .style("text-anchor", "end")
    //     .text(function(d) { return d.key; });

    
    // mouse hover
    // var mouseG = svg.append("g")
    //   .attr("class", "mouse-over-effects")
    //   .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    
    // mouseG.append("path") // this is the black vertical line to follow mouse
    //   .attr("class", "mouse-line")
    //   .style("stroke", "black")
    //   .style("stroke-width", "1px")
    //   .style("opacity", "0");

    // var mouseDateGroup = mouseG.append("g")
    //  .attr("class", "mouse-date-group")
    //  .style("opacity", "0");
    
    // mouseDateGroup.append("rect") // this is the black vertical line to follow mouse
    //   .attr("class", "mouse-line-rect")
    //   .style("stroke", "red")
    //   .style("width", "30px")
    //   .style("height", "10px")
    //   .attr("transform", "translate(-15 0)")
    //   .attr('fill', 'red')
    
    // mouseDateGroup.append("text")
    
    // var lines = document.getElementsByClassName('area');
    
    // var mousePerLine = mouseG.selectAll('.mouse-per-line')
    //     .data(stack(data))
    //   .enter()
    //     .append("g")
    //     .attr("class", "mouse-per-line");
    
    // mousePerLine.append("circle")
    //   .attr("r", 7)
    //   .style("fill", "#000")
    //   .style("stroke-width", "1px")
    //   .style("opacity", "1");

    // // mousePerLine.append("text")
    // //   .attr("transform", "translate(10,3)");

    // mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
    //   .attr('width', width) // can't catch mouse events on a g element
    //   .attr('height', height)
    //   .attr('fill', 'none')
    //   .attr('pointer-events', 'all')
    //   .on('mouseout', function() { // on mouse out hide line, circles and text
    //     d3.select(".mouse-line")
    //       .style("opacity", "0");
    //     d3.selectAll(".mouse-date-group")
    //       .style("opacity", "0");
    //     d3.selectAll(".mouse-per-line circle")
    //       .style("opacity", "0");
    //   })
    //   .on('mouseover', function(d) { // on mouse in show line, circles and text
    //     var mouse = d3.mouse(this);

    //     d3.select(".mouse-line")
    //       .style("opacity", "1");
    //     d3.selectAll(".mouse-date-group")
    //       .style("opacity", "1");
    //     d3.selectAll(".mouse-per-line circle")
    //       .style("opacity", function(d) {
    //         console.log(d);
    //         return "1";
    //       });
    //   })
    //   .on('mousemove', function() { // mouse moving over canvas
    //     var mouse = d3.mouse(this);
    //     d3.select(".mouse-line")
    //       .attr("d", function() {
    //         var d = "M" + mouse[0] + "," + height;
    //         d += " " + mouse[0] + "," + 0;
    //         return d;
    //       });
        
    //     d3.select(".mouse-line-rect")
    //       .attr("x", function() {
    //         var x = mouse[0];
    //         if (x <=  15) x = 15;
    //         if (x >=  width-15) x = width-15;
    //         return x;
    //       })
        
    //     d3.selectAll(".mouse-per-line")
    //       .attr("transform", function(d, i) {
    //         // var xDate = x.invert(mouse[0]),
    //         //     bisect = d3.bisector(function(d) { return d.date; }).right;
    //         //     idx = bisect(d.values, xDate);
    //         // console.log(bisect)
            
    //         var beginning = 0,
    //             end = lines[i].getTotalLength(),
    //             target = null;

    //         while (true){
    //           target = Math.floor((beginning + end) / 2);
    //           pos = lines[i].getPointAtLength(target);
    //           if ((target === end || target === beginning) && pos.x !== mouse[0]) {
    //               break;
    //           }
    //           if (pos.x > mouse[0])      end = target;
    //           else if (pos.x < mouse[0]) beginning = target;
    //           else break; // position found
    //         }
            
    //         d3.select(this).select('text')
    //           .text(y.invert(pos.y).toFixed(2));
              
    //         return "translate(" + mouse[0] + "," + pos.y +")";
    //       });
    //   });

  });
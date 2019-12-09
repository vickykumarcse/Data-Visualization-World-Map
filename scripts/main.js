//Global variables
let map = null;
let paths = null;

const width = 800;
const height = 600;

//Zoom configuration
const zoomFactor = 0.1;
const zoomMinLimit = 0.5;
const zoomMaxLimit = 10;
let currentTransform = d3.zoomIdentity;
const zoom = d3
  .zoom()
  .scaleExtent([zoomMinLimit, zoomMaxLimit])
  .translateExtent([[-width / 2, -height / 2], [width * 1.5, height * 1.5]])
  .on('zoom', () => {
    currentTransform = d3.event.transform;
    map.attr('transform', currentTransform);
  });

const zoomIn = () => {
  if (currentTransform.k + zoomFactor > zoomMaxLimit) {
    return;
  }
  currentTransform = calculateZoomTransform(
    currentTransform,
    zoomFactor,
    width,
    height
  );
  map.attr('transform', currentTransform);
};

const zoomOut = () => {
  if (currentTransform.k - zoomFactor < zoomMinLimit) {
    return;
  }
  currentTransform = calculateZoomTransform(
    currentTransform,
    -zoomFactor,
    width,
    height
  );
  map.attr('transform', currentTransform);
};

const zoomReset = () => {
  currentTransform.k = 1;
  currentTransform.x = 0;
  currentTransform.y = 0;
  map.attr('transform', currentTransform);
};

//Define SVG and Tooltip
const svg = d3.select('.map');
const tooltip = d3.select('.map-tooltip');
svg.attr('width', width + 'px');
svg.attr('height', height + 'px');
svg.call(zoom);

//Map is a group element
map = svg.append('g');

d3.select('.zoom-in').on('click', zoomIn);
d3.select('.zoom-out').on('click', zoomOut);
d3.select('.reset').on('click', zoomReset);

//Define color picker based on range
const colorPicker = d3
  .scaleThreshold()
  .domain([
    0,
    5000,
    10000,
    15000,
    20000,
    25000,
    30000,
    35000,
    40000,
    45000,
    50000
  ])
  .range([
    '#D7301F',
    '#EF6548',
    '#3498DB',
    '#47939e',
    '#A8C87D',
    '#F39C12',
    '#48C9B0',
    '#34495E',
    '#28B463',
    'yellow',
    '#808080'
  ]);

//Load data
d3.queue()
  .defer(d3.json, './data/countries.geojson')
  .defer(d3.csv, './data/countries_processed.csv')
  .awaitAll(drawMap);

//Draw map once data is loaded
function drawMap(error, data) {
  const mapData = data[0]; //Geo JSon
  const mapInfo = data[1]; //CSV
  //Add Country details to map geo json data
  mapData.features.map(el => {
    const name = el.properties.name;
    const info = mapInfo.find(item => {
      return item.Country.trim() === name.trim();
    });
    if (info) {
      el.properties.gdp = Number(info['GDP ($ per capita)']);
      el.properties.agriculture = Number(info['Agriculture']);
      el.properties.industry = Number(info['Industry']);
      el.properties.service = Number(info['Service']);
      el.properties.agricultureFrequency =
        el.properties.gdp * el.properties.agriculture;
      el.properties.industryFrequency =
        el.properties.gdp * el.properties.industry;
      el.properties.serviceFrequency =
        el.properties.gdp * el.properties.service;
    }
    return el;
  });

  //Create projection
  const projection = d3.geoMercator();

  //create geo path
  const path = d3.geoPath().projection(projection);

  //Assign all paths for later use
  paths = map
    .selectAll('path')
    .data(mapData.features)
    .enter()
    .append('path')
    .attr('d', path)
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('fill', d => {
      return colorPicker(d.properties.gdp);
    })
    .on('mousemove', d => {
      showTooltip(d);
    })
    .on('click', d => {
      drawCountryDetailGraph(d);
    });

  drawLegend();
}

//Show tooltip on mousemove
function showTooltip(d) {
  const html = `
    <p class="head"> </p>
    <p class="name"> ${d.properties.name} <p>
    <p> GDP: ${d.properties.gdp || 'NA'} </p>
  `;
  tooltip.html(html);
  tooltip
    .style('visibility', 'visible')
    .style('top', `${d3.event.layerY + 100}px`)
    .style('left', `${d3.event.layerX + 18}px`);

  let timeout = null;
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    tooltip.style('visibility', 'hidden');
  }, 5000);
}

function calculateZoomTransform(transform, zoomFactor, width, height) {
  const scale = transform.k;
  const newScale = scale + zoomFactor;
  const tx = transform.x;
  const ty = transform.y;
  const center = [width / 2, height / 2];
  transform.k = newScale;
  transform.x = center[0] + ((tx - center[0]) / scale) * newScale;
  transform.y = center[1] + ((ty - center[1]) / scale) * newScale;
  return transform;
}

function drawLegend() {
  let formatNumber = d3.format('.0f');

  let x = d3
    .scaleLinear()
    .domain([0, 40])
    .range([0, 240]);
  let xAxis = d3
    .axisBottom(x)
    .tickSize(13)
    .tickValues([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50])
    .tickFormat(d => {
      return `${formatNumber(d)}K`;
    });
  let legend = d3
    .select('.legend')
    .append('g')
    .call(xAxis);

  legend
    .selectAll('rect')
    .data(
      colorPicker.range().map(color => {
        let d = colorPicker.invertExtent(color);
        if (d[0] == null) d[0] = x.domain()[0];
        if (d[1] == null) d[1] = x.domain()[1];
        return d;
      })
    )
    .enter()
    .insert('rect', '.tick')
    .attr('height', 8)
    .attr('x', d => {
      return x(d[0]) / 1000;
    })
    .attr('width', d => {
      return (x(d[1]) - x(d[0])) / 1000;
    })
    .attr('fill', d => {
      return colorPicker(d[0]);
    });

  legend
    .append('text')
    .attr('fill', '#000')
    .attr('font-weight', 'bold')
    .attr('text-anchor', 'start')
    .attr('y', -6)
    .text('GDP');

  legend.style('transform', 'translate(100px, 30px)');
}

function drawCountryDetailGraph(country) {
  const heading = document.querySelector('.country-heading');
  document.querySelector('.country-detail').innerHTML = '';
  heading.innerHTML = country.properties.name;
  const data = [
    {
      name: 'Agricultre',
      value: country.properties.agricultureFrequency
    },
    {
      name: 'Industry',
      value: country.properties.industryFrequency
    },
    {
      name: 'Service',
      value: country.properties.serviceFrequency
    }
  ];
  const margin = { top: 20, right: 20, bottom: 30, left: 40 },
    width = 400 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

  const x = d3
    .scaleBand()
    .range([0, width])
    .padding(0.5);
  const y = d3.scaleLinear().range([height, 0]);

  const svg = d3
    .select('.country-detail')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  x.domain(
    data.map(el => {
      return el.name;
    })
  );
  y.domain([0, 50000]);

  svg
    .selectAll('.bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => {
      return x(d.name);
    })
    .attr('width', x.bandwidth())
    .attr('y', d => {
      return y(d.value);
    })
    .attr('height', d => {
      return height - y(d.value);
    })
    .attr('fill', colorPicker(country.properties.gdp));

  svg
    .selectAll('text.bar')
    .data(data)
    .enter()
    .append('text')
    .attr('class', 'bar')
    .attr('text-anchor', 'middle')
    .attr('x', d => {
      return x(d.name) + x.bandwidth() / 2;
    })
    .attr('y', d => {
      return y(d.value) - 5;
    })
    .text(d => {
      return d.value.toFixed(2);
    });

  svg
    .append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x));

  svg.append('g').call(d3.axisLeft(y));

  svg
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0)
    .attr('x', -68)
    .attr('dy', '1em')
    .style('text-anchor', 'top')
    .text('Frequency');
}

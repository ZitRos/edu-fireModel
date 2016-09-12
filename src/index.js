const VARIANT = 7, // Nikita Savchenko
      WIDTH = 4000, // meters
      HEIGHT = 4000,
      STEP = 100,
      INITIAL_FIREPLACE = [-100, -100, 100, 100], // (x;y) from -> (x;y) to
      SIMULATION_SPEED = 40000; // number of milliseconds to simulate an hour

const TREES = { type: 0, price: 500, class: "forest" },
      FIRE = { type: 1, class: "fire" },
      HOUSES = { type: 0, price: 500, class: "houses" },
      EXPLOSION = { type: 2, price: 100000, class: "explosive" };

const variants = [
    [[-1, 1], 0.5, 0.5], // [direction [x, y], speed (m/s), duration (h)]
    [[-1, 0], 1, 1],
    [[1, 0], 0.5, 0.5],
    [[1, -1], 2, 1],
    [[-1, -1], 2.5, 0.5],
    [[0, 1], 1, 0.5],
    [[1, 1], 2, 0.5], // start
    [[0, 1], 1, 0.5],
    [[-1, -1], 0.5, 1],
    [[1, 0], 1, 1]
];

/**
 * @type {HTMLElement|null}
 */
let graph = null,
    chart = null;

let currentVariant = VARIANT - 1;

let field = [],
    damage,
    vis;

for (let i = 0; i < HEIGHT/STEP; i++) {
    field[i] = [];
    for (let j = 0; j < WIDTH/STEP; j++) {
        field[i][j] = TREES;
    }
}
addRect(-2000, -2000, -1500, -500, HOUSES);
addRect(-1500, -2000, -1000, -1000, HOUSES);
addRect(-1000, -2000, -500, -1500, HOUSES);
addRect(500, 500, 1000, 1000, EXPLOSION);

function fillWithObject (xf = 0, yf = 0, xt = Math.max(xf, 0), yt = Math.max(yf, 0), obj) {
    for (let i = yf; i < yt; i += STEP) {
        for (let j = xf; j < xt; j += STEP) {
            field[Math.floor((i + HEIGHT/2)/STEP)][Math.floor((j + WIDTH/2)/STEP)] = obj;
        }
    }
}

function nextVariant () {
    currentVariant = (currentVariant + 1) % variants.length;
    changeVisualDir();
}

function drawField () {

    graph.innerText = "";
    let par = graph.parentNode;
    par.removeChild(graph);
    for (let i = 0; i < HEIGHT/STEP; i++) {
        for (let j = 0; j < WIDTH/STEP; j++) {
            let el = document.createElement("div");
            el.className = field[i][j].class;
            el.style.left = 100*j/(WIDTH/STEP) + "%";
            el.style.top = 100*i/(HEIGHT/STEP) + "%";
            el.style.width = 100/(WIDTH/STEP) + "%";
            el.style.height = 100/(HEIGHT/STEP) + "%";
            graph.appendChild(el);
        }
    }
    par.appendChild(graph);
}

function mergeArrays (arr) {
    if (!arr.length)
        return arr;
    let a = [],
        maxLen = arr.map(e => e.length).reduce((a, b) => Math.max(a, b));
    for (let i = 0; i < maxLen; i++) {
        let sa = [];
        for (let j = 0; j < arr.length; j++) {
            if (arr[j][i]) sa.push(arr[j][i]);
        }
        a.push(sa);
    }
    return a;
}

function changeVisualDir () {
    document.getElementById("arrow").style.transform = `rotate(${
        Math.atan2(variants[currentVariant][0][1], variants[currentVariant][0][0])
    }rad)`;
    let str = (variants[currentVariant][0][0] + 1) + "" + (variants[currentVariant][0][1] + 1),
        txt = "";
    switch (str) {
        case "10": txt = "South"; break;
        case "20": txt = "South-East"; break;
        case "21": txt = "East"; break;
        case "22": txt = "North-East"; break;
        case "12": txt = "North"; break;
        case "02": txt = "North-West"; break;
        case "01": txt = "West"; break;
        case "00": txt = "South-West"; break;
    }
    document.getElementById("dirSign").textContent = "Wind: " + txt;
}

// expands fire for 0.5 hours
function expandFire (HOURS = 0.5, SPEED = 0.5, x, y, [dx, dy]) {
    let toExpand =
            (SPEED*HOURS*60*60
                + (Math.abs(dx) === 1 && Math.abs(dy) === 1 ? 1/Math.sqrt(2) : 1)) / STEP,
        wavesOfChanges = [];
    for (let i = 1; i < toExpand; i++) {
        let cx = x + dx*i, cy = y + dy*i;
        let obj = (field[cy] || "")[cx];
        if (!obj) break;
        if (obj.type === TREES.type) {
            // damage += (obj.price || 0) * STEP * STEP;
            // field[cy][cx] = FIRE;
            wavesOfChanges[i - 1] = [cx, cy, (obj.price || 0) * STEP * STEP, FIRE];
        } else if (obj.type === EXPLOSION.type) {
            // allow multiple ways to be in the same place
            break;
        } else {
            break;
        }
    }
    return wavesOfChanges;
}

function step () {
    drawField();
    let fireAt = [],
        speed = variants[currentVariant][1],
        duration = variants[currentVariant][2];
    for (let i = 0; i < HEIGHT/STEP; i++) {
        for (let j = 0; j < WIDTH/STEP; j++) {
            if (field[i][j].type !== FIRE.type) continue;
            fireAt.push([j, i]); // j then i!
        }
    }
    // now we have fire places in [ [x, y], [x, y] ]
    let changes = mergeArrays(fireAt.map(
        f => expandFire(duration, speed, f[0], f[1], variants[currentVariant][0])
    ).filter(a => a.length));
    let stepTime = SIMULATION_SPEED * duration,
        changeTime = stepTime / changes.length,
        times = changes.length,
        closureInterval = setInterval(closure, times > 0 ? changeTime : stepTime);
    console.log("st", stepTime);
    function closure () {
        if (--times < 0) {
            addPlotPoint();
            clearInterval(closureInterval);
            nextVariant();
            step();
            return;
        }

        let change = changes[changes.length - times - 1];
        try {
            change.forEach((c) => {
                field[c[1]][c[0]] = c[3];
                damage += c[2];
            });
            drawField();
        } catch (e) {
            console.log("!!!", change);
            clearInterval(closureInterval);
        }

        addPlotPoint();
    }
    if (times > 0)
        closure();
}

window.addEventListener("load", () => {
    graph = document.getElementById("graphics");
    chart = document.getElementById("chart");
    fillWithObject.apply(this, INITIAL_FIREPLACE.concat([FIRE]));
    damage = (INITIAL_FIREPLACE[2] - INITIAL_FIREPLACE[0]) // initial damage
        * (INITIAL_FIREPLACE[3] - INITIAL_FIREPLACE[1]) * TREES.price;
    loader();
} ,false);

function addPlotPoint () {
    if (vis) vis.addPoint([new Date(), damage], true);
}

let _ll = 0;
function loader () {
    _ll++;
    if (_ll < 2) return;
    addPlotPoint();
    step();
    changeVisualDir();
}

$(function () {
    $(document).ready(function () {
        Highcharts.setOptions({
            global: {
                useUTC: false
            }
        });

        $('#chart').highcharts({
            chart: {
                type: 'spline',
                animation: Highcharts.svg, // don't animate in old IE
                marginRight: 10,
                events: {
                    load: function () {
                        vis = this.series[0];
                        loader();
                    }
                }
            },
            title: {
                text: 'Damage, $'
            },
            xAxis: {
                type: 'datetime',
                tickPixelInterval: 150
            },
            yAxis: {
                title: {
                    text: 'Value'
                },
                plotLines: [{
                    value: 0,
                    width: 1,
                    color: '#808080'
                }]
            },
            tooltip: {
                formatter: function () {
                    return '<b>' + this.series.name + '</b><br/>$' + this.y
                }
            },
            legend: {
                enabled: false
            },
            exporting: {
                enabled: false
            },
            series: [{
                name: 'Damage, $',
                data: []
            }]
        });
    });
});

function xToR (x) {
    return Math.floor((x + WIDTH/2)/STEP);
}

function yToR (y) {
    return Math.floor((y + HEIGHT/2)/STEP);
}

function addRect (x1, y1, x2, y2, type) {
    for (let y = yToR(y1); y < yToR(y2); y++) {
        for (let x = xToR(x1); x < xToR(x2); x++) {
            field[y][x] = type;
        }
    }
}
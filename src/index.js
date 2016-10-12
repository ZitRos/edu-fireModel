const
    CANVAS_WIDTH = 500,
    CANVAS_HEIGHT = 500,
    VARIANT = 7, // Nikita Savchenko
    WIDTH = 4000, // meters
    HEIGHT = 4000,
    STEP = WIDTH/CANVAS_WIDTH,
    FIRE_FRONT_SPEED = 0.1, // koef
    INITIAL_FIREPLACE = [1900, 1900, 2100, 2100], // (x;y) from -> (x;y) to
    FPS = 30,
    SANATORIUM_IDLING_PRICE = 100/60, // in 1 sec
    PLOTTING_INTERVAL = 500, // number of milliseconds to simulate an hour
    EXPLODE_RADIUS = 10;

const variants = [
    [[-1, 1], 0.5, 0.5], // [direction [dx, dy], speed (m/s), duration (h)]
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

const TYPE_TREES = { price: 500, destructible: true, r: 67, g: 172, b: 67 },
      TYPE_EXPLOSIVE = { price: 0.4, destructible: true, explodes: true, r: 255, g: 172, b: 0 },
      TYPE_HOUSES = { price: 500, destructible: true, r: 170, g: 130, b: 12 },
      TYPE_AIRPORT = { price: 1000000, destructible: true, disables: true, r: 70, g: 30, b: 250 },
      TYPE_SANATORIUM = { price: 0, destructible: true, disables: true, r: 190, g: 20, b: 250 },
      TYPE_WATER = { price: 0, destructible: false, r: 20, g: 190, b: 250 };

let damage = 0,
    canvas = null,
    image,
    chart = null,
    field = [],
    currentVariant = VARIANT - 1,
    time = 0,
    sanatoriumIdling = false,
    SIMULATION_SPEED = 1600; // how much times faster to simulate;

function getFront (dx = 1, dy = 0) {
    let f = [];
    for (let i = 0; i < HEIGHT/STEP; i++) {
        for (let j = 0; j < WIDTH/STEP; j++) {
            if (field[i][j].health === 0 && field[i + dy] && field[i + dy][j + dx]
                && field[i + dy][j + dx].type.destructible && field[i + dy][j + dx].health > 0
                && field[i + dy][j + dx].enabled) {
                f.push({ x: j + dx, y: i + dy });
            }
        }
    }
    return f;
}

function explode (x, y) {
    let a = [];
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            let xx = x + i, yy = y + j;
            if (!field[yy] || !field[yy][xx] || !field[yy][xx].type.explodes || !field[yy][xx].health)
                continue;
            field[yy][xx].health = 0;
            damage += field[yy][xx].type.price || 0;
            a.push({ x: xx, y: yy });
        }
    }
    a.forEach(e => explode(e.x, e.y));
}

function disable (x, y, fix = true) {
    let a = [];
    if (fix && field[y][x].type === TYPE_SANATORIUM) {
        sanatoriumIdling = true;
    }
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            let xx = x + i, yy = y + j;
            if (!field[yy] || !field[yy][xx] || !field[yy][xx].type.disables || !field[yy][xx].enabled)
                continue;
            field[yy][xx].enabled = false;
            if (fix) damage += field[yy][xx].type.price;
            a.push({ x: xx, y: yy });
        }
    }
    a.forEach(e => disable(e.x, e.y, false));
}

function step (front, k, t = 0) {
    if (!front.length) return;
    let min = front.map(e => field[e.y][e.x].health).reduce((a, b) => Math.min(a, b)),
        t1 = k * min;
    for (let i = 0; i < front.length; i++) {
        let e = front[i],
            dt = Math.min(1, t / t1),
            dmg = min * dt;
        if (field[e.y][e.x].type.explodes) {
            explode(e.x, e.y);
            return step(getFront(variants[currentVariant][0][0], variants[currentVariant][1]), k, t + EXPLODE_RADIUS/STEP);
        } else if (field[e.y][e.x].type.disables) {
            disable(e.x, e.y);
            return step(getFront(variants[currentVariant][0][0], variants[currentVariant][1]), k, t);
        }
        field[e.y][e.x].health -= dmg;
        damage += dmg * field[e.y][e.x].type.price || 0;
        if (sanatoriumIdling)
            damage += SANATORIUM_IDLING_PRICE * dt;
    }
    return t1 > t ? 0 : t - t1;
}

function loop (t, windSpeed, dir) {
    let lt = Date.now(), st = 0;
    let vF = windSpeed * FIRE_FRONT_SPEED;
    while ((t = step(getFront(dir[0], dir[1]), STEP / vF, t)) > 0) {
        st++;
    }
    console.log("Step compute time:", Date.now() - lt, "Steps:", st);
}

function variantLoop () {
    let t = variants[currentVariant][2] * 60 * 60,
        windSpeed = variants[currentVariant][1];
    let interval = setInterval(() => {
        let nt = Math.max(0, t - (1 / FPS) * SIMULATION_SPEED),
            delta = t - nt;
        time += delta;
        t = nt;
        if (delta > 0) {
            loop(delta, windSpeed, variants[currentVariant][0]);
            render();
            return;
        }
        clearInterval(interval);
        nextVariant();
        variantLoop();
        render();
    }, 1000 / FPS);
}

function init () {
    canvas = document.getElementById(`graphics`).getContext(`2d`);
    image = canvas.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    document.getElementById("num").value = SIMULATION_SPEED;
    document.getElementById("num").addEventListener("change", () => {
        SIMULATION_SPEED = document.getElementById("num").value;
    });
    changeVisualDir();
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
    for (let i = 0; i < HEIGHT/STEP; i++) {
        field[i] = [];
        for (let j = 0; j < WIDTH/STEP; j++) {
            field[i][j] = {
                type: TYPE_TREES,
                health: INITIAL_FIREPLACE[0] <= j*STEP && INITIAL_FIREPLACE[2] > j*STEP
                    && INITIAL_FIREPLACE[1] <= i*STEP && INITIAL_FIREPLACE[3] > i*STEP ? 0 : 1,
                enabled: true
            };
        }
    }
    damage = TYPE_TREES.price * (INITIAL_FIREPLACE[2] - INITIAL_FIREPLACE[0])
        * (INITIAL_FIREPLACE[3] - INITIAL_FIREPLACE[1]);
    fillField(2500, 2500, 3000, 3000, {
        type: TYPE_EXPLOSIVE,
        health: 1,
        enabled: true
    });
    fillField(2500, 0, 3000, 1000, {
        type: TYPE_SANATORIUM,
        health: 1,
        enabled: true
    });
    createLake();
    let h = { type: TYPE_HOUSES, health: 1, enabled: true };
    fillField(0, 0, 1500, 500, h);
    fillField(0, 500, 1000, 1000, h);
    fillField(0, 1000, 500, 1500, h);
    createAirport();
    render();
    variantLoop();
    setInterval(addPlotPoint, PLOTTING_INTERVAL);
}

////////////////////////////////////////////////////////////////////////////////////////////////////

function render () {
    let tt = Date.now();
    let ws = WIDTH / STEP,
        hs = HEIGHT / STEP;
    for (let i = 0; i < hs; i++) {
        if (!field[i]) return;
        for (let j = 0; j < ws; j++) {
            if (!field[i][j]) return;
            let k = (i * ws + j) * 4, h = 1-field[i][j].health;
            image.data[k] = field[i][j].type.r + (255 - field[i][j].type.r) * h;
            image.data[k + 1] = field[i][j].type.g - (field[i][j].type.g) * h;
            image.data[k + 2] = field[i][j].type.b - (field[i][j].type.b) * h;
        }
    }
    canvas.putImageData(image, 0, 0);
    console.log(`Render time:`, Date.now() - tt);
    let t = Math.floor(time / 60), // mins
        d = Math.floor(t / (60 * 24)),
        h = Math.floor((t - d*24*60) / 60),
        m = Math.floor((t - d*24*60 - h*60));
    document.getElementById("timeDays").textContent = d + "";
    document.getElementById("timeHours").textContent = h + "";
    document.getElementById("timeMinutes").textContent = m + "";
}

function nextVariant () {
    currentVariant = (currentVariant + 1) % variants.length;
    changeVisualDir();
}

function addPlotPoint () {
    chart.addPoint([time, damage], true);
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
    document.getElementById("windSpeed").textContent = variants[currentVariant][1];
}

function fillField (xf, yf, xt, yt, obj) {
    for (let j = Math.floor(yf / STEP); j < yt / STEP; j++) {
        for (let i = Math.floor(xf / STEP); i < xt / STEP; i++) {
            field[j][i] = Object.assign({}, obj);
        }
    }
}

function createAirport () {
    let o = { type: TYPE_AIRPORT, health: 1, enabled: true };
    fillField(0, 2500, 500, 4000, o);
    fillField(500, 3500, 1000, 4000, o);
    for (let y = Math.floor(2500/STEP); y < 3500/STEP; y++) {
        let x = Math.floor(500 * (y - Math.floor(2500/STEP)) / Math.floor(1000/STEP));
        fillField(500, y * STEP, 500 + x, y * STEP + 1, o);
    }
}

function getBezier () {
    let a1 = { x: 2500, y: 0 },
        a25 = { x: 10000, y: 1500 },
		a2 = { x: 2900, y: 1500 },
        a3 = { x: 4000, y: 1000 },
        arr = [];
    for (let t = 0; t <= 1; t += 0.005) {
        arr.push({
            x: Math.pow(1-t, 3)*a1.x + Math.pow(1-t, 2)*t*a25.x + 2*(1-t)*t*t*a2.x + Math.pow(t, 3)*a3.x,
            y: Math.pow(1-t, 3)*a1.y + Math.pow(1-t, 2)*t*a25.y + 2*(1-t)*t*t*a2.y + Math.pow(t, 3)*a3.y
        });
    }
    return arr;
}

function createLake () {
    let o = { type: TYPE_WATER, health: 1, enabled: true },
        arr = getBezier();
    for (let y = 0; y < 1000/STEP; y++) {
        let j = 0;
        for (; (arr[j] || {}).y < y*STEP; j++) {  }
        if ((arr[j] || {}).x)
            fillField(arr[j].x, y * STEP, 4000, y * STEP + 1, o);
    }
}

$(document).ready(() => {

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
                    chart = this.series[0];
                    init();
                }
            }
        },
        title: {
            text: 'Damage Plot'
        },
        xAxis: {
            type: 'time',
            tickPixelInterval: 150,
            title: {
                text: 'Time, seconds'
            }
        },
        yAxis: {
            title: {
                text: 'Damage value, $'
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
            name: 'Damage',
            data: []
        }]
    });

});
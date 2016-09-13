const
    CANVAS_WIDTH = 500,
    CANVAS_HEIGHT = 500,
    VARIANT = 7, // Nikita Savchenko
    WIDTH = 4000, // meters
    HEIGHT = 4000,
    STEP = WIDTH/CANVAS_WIDTH,
    INITIAL_FIREPLACE = [1900, 1900, 2100, 2100], // (x;y) from -> (x;y) to
    SIMULATION_SPEED = 40000; // number of milliseconds to simulate an hour

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

const TYPE_TREES = { price: 100, destructible: true, r: 67, g: 172, b: 67 };

let damage = 0,
    canvas = null,
    image,
    chart = null,
    field = [];

function getFront (dx = 1, dy = 0) {
    let f = [];
    for (let i = 0; i < HEIGHT/STEP; i++) {
        for (let j = 0; j < WIDTH/STEP; j++) {
            if (field[i][j].health === 0 && field[i + dy] && field[i + dy][j + dx]
                && field[i + dy][j + dx].type.destructible && field[i + dy][j + dx].health > 0) {
                f.push({ x: j + dx, y: i + dy });
            }
        }
    }
    return f;
}

function step (front, k, t) {
    let min = front.map(e => field[e.y][e.x].health).reduce((a, b) => Math.min(a, b)),
        t1 = k * min;
    front.forEach(e => field[e.y][e.x].health -= min * Math.min(1, t / t1));
    return t1 > t ? 0 : t - t1;
}

function loop () {
    let t = 0.5*60*60,
        vF = 2 * 0.1;
    while ((t = step(getFront(), STEP / vF, t)) > 0) {
        //
    }
}

function init () {
    canvas = document.getElementById(`graphics`).getContext(`2d`);
    image = canvas.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
    render();
    loop();
    render();
}

////////////////////////////////////////////////////////////////////////////////////////////////////

function render () {
    let t = Date.now();
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
    console.log(`Render time:`, Date.now() - t);
}

function addPlotPoint () {
    chart.addPoint([new Date(), damage], true);
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
            text: 'Damage, $'
        },
        xAxis: {
            type: 'time',
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
            name: 'Damage',
            data: []
        }]
    });

});
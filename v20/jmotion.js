// jmotion namespace
var jmotion = jmotion || {};
jmotion.VERSION = "2.0";
(function(parent) {

    // Facade class for simulator
    class Facade {
        #animator;

        // constructor
        constructor(svg, generator) {
            this.#animator = new jmotion.Animator(new jmotion.Core(svg));
            if (generator != null && typeof generator.calculateOrbits == "function") {
                this.generator = generator;
            } else {
                this.generator = new jmotion.CalmGenerator();
            }
        }

        // get animation handler
        get animator() {
            return this.#animator;
        }

        // start juggling simulator
        startJuggling(text) {
            if (!text) {
                // pattern is not specified
                const status = this.#animator.status;
                if (!status.runnable) {
                    return "No data for animation.";
                }
                if (!status.running) {
                    this.#animator.start(1);
                }
                return "";
            }

            // analyze the input value
            this.#animator.stop();
            const result = jmotion.Siteswap.analyze(text);
            if (!result.valid) {
                return result.message;
            }

            // create coordinate list
            const table = jmotion.Siteswap.separate(result.throws, result.sync);
            const orbits = this.generator.calculateOrbits(table, result.sync, result.throws);
            this.#animator.props = orbits.props;
            this.#animator.arms = orbits.arms;
            this.#animator.core.scale = this.generator.scale;
            this.#animator.core.setStyle({ "stroke-width": this.generator.width });

            // start animation
            this.#animator.index = 0;
            this.#animator.start(1);
            return "";
        }

        // stop juggling simulator
        stopJuggling() {
            this.#animator.stop();
        }

    }

    // Animation handling class
    class Animator {
        #core;
        #interval = 40;
        #moveId = 0;
        #index = 0;
        #speed = 1;

        // constructor
        constructor(core) {
            this.#core = core;
            this.props = [];
            this.arms = [];
        }

        // get drawing core
        get core() {
            return this.#core;
        }

        // get speed
        get speed() {
            return this.#speed;
        }

        // set speed
        set speed(value) {
            const number = parseFloat(value);
            if (isNaN(number)) {
                return;
            }
            this.#speed = number;
        }

        // get running index
        get index() {
            return this.#index;
        }

        // set running index
        set index(value) {
            const number = parseFloat(value);
            if (isNaN(number)) {
                this.#index = 0;
            } else {
                this.#index = Math.max(0, number);
            }
            this.#draw();
        }

        // get running status
        get status() {
            const running = 0 < this.#moveId;
            const runnable = running || 0 < this.props.length || 0 < this.arms.length;
            return { "running": running, "runnable": runnable };
        }

        // start animation
        start(speed) {
            if (0 < this.#moveId) {
                return;
            }
            this.speed = speed;
            this.#moveId = setInterval(this.#run.bind(this), this.#interval);
        }

        // stop animation
        stop() {
            if (this.#moveId == 0) {
                return;
            }
            clearInterval(this.#moveId);
            this.#moveId = 0;
        }

        // draw continuously
        #run() {
            this.#index += this.#speed;
            this.#draw();
        }

        // draw shapes
        #draw() {
            // get coordinates
            const index = Math.floor(this.#index);
            if (index < 0) {
                return;
            }
            const props = this.#getCurrent(this.props, index);
            const arms = this.arms.map(elem => this.#getCurrent(elem, index));

            // draw props and arms separately
            this.#core.drawProps(props);
            this.#core.drawArms(arms);
        }

        // get current coordinates
        #getCurrent(moves, index) {
            const current = [];
            for (const move of moves) {
                if (index < move.init.length) {
                    current.push(move.init[index]);
                } else if (0 < move.loop.length) {
                    current.push(move.loop[(index - move.init.length) % move.loop.length]);
                }
            }
            return current;
        }

    }

    // Drawing core class (public part)
    class Core {
        #svg;
        #defs;
        #back;
        #middle;
        #front;
        #arms = [];
        #hands = [];
        #pool = [];
        #props = [];
        #uses = [];
        #area = new DOMRect(-150, -255, 300, 300);
        #scale = 1;

        // constructor
        constructor(element, cancel) {
            // drawing area
            const id = this.#getNewId("jmotion_core");
            if (typeof element == "string" || element instanceof String) {
                element = document.querySelector(element);
            }
            if (element && element.viewBox instanceof SVGAnimatedRect) {
                if (element.id == "") {
                    element.id = id;
                }
            } else {
                const div = element;
                element = this.#getShape("svg", id);
                if (div && typeof div.appendChild == "function") {
                    // for the parent element
                    div.appendChild(element);
                }
            }
            this.#svg = element;

            // definition area
            const exists = this.#svg.getElementsByTagName("defs");
            if (0 < exists.length) {
                this.#defs = exists[0];
            } else {
                this.#defs = this.#getShape("defs", "definition");
                this.#svg.appendChild(this.#defs);
            }

            // layer
            this.#back = this.#getShape("g", "back");
            this.#middle = this.#getShape("g", "middle");
            this.#front = this.#getShape("g", "front");
            this.#svg.appendChild(this.#back);
            this.#svg.appendChild(this.#middle);
            this.#svg.appendChild(this.#front);

            // initial settings
            if (!cancel) {
                this.#initialize();
            }
            this.setStyle({ "fill": "white", "stroke": "black", "stroke-width": 1 });
            this.scale = 1;
        }

        // get SVG object
        get svg() {
            return this.#svg;
        }

        // get definitional part
        get defs() {
            return this.#defs;
        }

        // get back layer
        get back() {
            return this.#back;
        }

        // get middle layer
        get middle() {
            return this.#middle;
        }

        // get front layer
        get front() {
            return this.#front;
        }

        // get prop elements
        get props() {
            return this.#props;
        }

        // set prop elements
        set props(elements) {
            // remove existing elements
            this.#removeIds(this.#pool);
            this.#props = [];
            this.#pool = [];
            if (!Array.isArray(elements)) {
                return;
            }
            this.#removeIds(elements.map(elem => elem.id));

            // set as the definition
            for (let i = 0; i < elements.length; i++) {
                const prop = elements[i];
                if (!prop.id) {
                    prop.id = this.#getNewId(`${this.#svg.id}_prop`);
                }
                this.#pool.push(prop.id);
                this.#defs.appendChild(prop);

                // use the definition
                const use = this.#getShape("use", `prop_${i}`, [ prop.id ]);
                this.#props.push(use);
            }
        }

        // get screen scale
        get scale() {
            return this.#scale;
        }

        // set screen scale
        set scale(value) {
            const number = parseFloat(value);
            if (isNaN(number) || number <= 0) {
                return;
            }
            this.#scale = number;

            // change scale
            const stride = this.#area.width * number;
            this.#svg.setAttribute("viewBox", `${-stride / 2} ${this.#area.y * number} ${stride} ${stride}`);
        }

        // set body elements
        setBody(elements, append, layer) {
            if (!layer) {
                layer = this.#back;
            }
            if (!append) {
                // remove existing elements
                const children = Array.from(layer.children);
                const targets = children.filter(elem => !this.#hands.includes(elem) && this.#arms.every(arm => !arm.includes(elem)));
                targets.forEach(layer.removeChild, layer);
            }
            if (!Array.isArray(elements)) {
                return;
            }

            // set to the layer
            elements.forEach(layer.appendChild, layer);
        }

        // set arm elements
        setArms(arms, layer) {
            if (!layer) {
                layer = this.#back;
            }

            // remove existing elements
            this.#arms.forEach(this.#eraseLayer, this);
            this.#arms = [];
            if (!Array.isArray(arms)) {
                return;
            }

            // set to the layer
            for (const elements of arms.filter(Array.isArray, Array)) {
                elements.concat().reverse().forEach(layer.appendChild, layer);
                this.#arms.push(elements);
            }
        }

        // set hand elements
        setHands(elements, layer) {
            if (!layer) {
                layer = this.#front;
            }

            // remove existing elements
            this.#eraseLayer(this.#hands);
            this.#hands = [];
            if (!Array.isArray(elements)) {
                return;
            }

            // set to the layer
            for (let hand of elements) {
                if (!(hand instanceof SVGUseElement)) {
                    // if not SVGUseElement, convert to SVGUseElement
                    if (!hand.id) {
                        hand.id = this.#getNewId(`${this.#svg.id}_hand`);
                    }
                    this.#defs.appendChild(hand);
                    hand = this.#getShape("use", `${hand.id}_use`, [ hand.id ]);
                }
                layer.appendChild(hand);
                this.#hands.push(hand);
            }
        }

        // set display style
        setStyle(style, layer) {
            let layers = [];
            if (layer) {
                if (Array.isArray(layer)) {
                    layers = layer;
                } else {
                    layers.push(layer);
                }
            } else {
                layers.push(this.#back);
                layers.push(this.#front);
            }

            // set styles for each element
            for (const name in style) {
                const value = style[name];
                layers.forEach(group => Array.from(group.children).forEach(elem => elem.setAttribute(name, value)));
            }
        }

        // draw props
        drawProps(props) {
            if (!Array.isArray(props)) {
                return;
            }

            // check if it has increased or decreased
            const diff = props.length - this.#uses.length;
            if (diff < 0) {
                // decreased
                while (props.length < this.#uses.length) {
                    this.#middle.removeChild(this.#uses.pop());
                }
            } else if (0 < diff) {
                // increased
                for (let i = this.#props.length; i < props.length; i++) {
                    const id = this.#pool[i % this.#pool.length];
                    const prop = this.#getShape("use", `prop_${i}`, [ id ]);
                    this.#props.push(prop);
                }
                const before = this.#uses.length;
                for (let i = before; i < props.length; i++) {
                    this.#uses.push(this.#props[i]);
                }

                // add to screen in reverse order
                for (let i = before; i < this.#uses.length; i++) {
                    this.#middle.insertBefore(this.#uses[i], this.#uses[i - 1]);
                }
            }

            // draw
            for (let i = 0; i < props.length; i++) {
                this.#uses[i].setAttribute("x", props[i].x);
                this.#uses[i].setAttribute("y", props[i].y);
            }
        }

        // draw arms
        drawArms(arms) {
            if (!Array.isArray(arms)) {
                return;
            }

            // draw for each arm
            for (let i = 0; i < arms.length; i++) {
                const joints = arms[i];
                if (!Array.isArray(joints) || joints.length == 0) {
                    continue;
                }
                if (i < this.#hands.length) {
                    // hand
                    this.#hands[i].setAttribute("x", joints[0].x);
                    this.#hands[i].setAttribute("y", joints[0].y);
                }
                if (i < this.#arms.length) {
                    const lines = this.#arms[i];
                    let j = 1;
                    while (j < joints.length && j <= lines.length) {
                        // joints
                        lines[j - 1].setAttribute("x1", joints[j - 1].x);
                        lines[j - 1].setAttribute("y1", joints[j - 1].y);
                        lines[j - 1].setAttribute("x2", joints[j].x);
                        lines[j - 1].setAttribute("y2", joints[j].y);
                        j++;
                    }
                    if (j == joints.length && j == lines.length) {
                        // shoulder
                        lines[j - 1].setAttribute("x1", joints[j - 1].x);
                        lines[j - 1].setAttribute("y1", joints[j - 1].y);
                    }
                }
            }
        }

        // initial setting
        #initialize() {
            // body
            const body = [
                this.#getShape("circle", "head", [ 20, 0, -120 ]),
                this.#getShape("line", "shoulder", [ -50, -90, 50, -90 ]),
            ];
            this.setBody(body);

            // hands
            const hand = this.#getShape("rect", "hand", [ -10, 0, 20, 5 ]);
            this.#defs.appendChild(hand);
            const hands = [
                this.#getShape("use", "right_hand", [ hand.id, -90, 10 ]),
                this.#getShape("use", "left_hand", [ hand.id, 90, 10 ]),
            ];
            this.setHands(hands);

            // arms
            const right = [
                this.#getShape("line", "right_0", [ -90, 10, -70, -30 ]),
                this.#getShape("line", "right_1", [ -70, -30, -50, -90 ]),
            ];
            const left = [
                this.#getShape("line", "left_0", [ 90, 10, 70, -30 ]),
                this.#getShape("line", "left_1", [ 70, -30, 50, -90 ]),
            ];
            this.setArms([ right, left ]);

            // props
            const props = [];
            const colors = [ "red", "lime", "blue", "orange", "gray", "maroon", "green", "aqua", "olive", "fuchsia", "teal", "yellow", "navy", "silver", "purple", "black" ];
            for (const color of colors) {
                const shape = this.#getShape("circle", `prop_${color}`, [ 10 ]);
                shape.setAttribute("fill", color);
                props.push(shape);
            }
            this.props = props;
        }

        // get svg shape
        #getShape(type, id, setting) {
            // create attributes
            if (this.#svg) {
                id = `${this.#svg.id}_${id}`;
            }
            const attribute = { "id": id };
            switch (type) {
                case "circle":
                    attribute.r = setting[0] || 1;
                    attribute.cx = setting[1] || 0;
                    attribute.cy = setting[2] || 0;
                    break;

                case "line":
                    attribute.x1 = setting[0] || 0;
                    attribute.y1 = setting[1] || 0;
                    attribute.x2 = setting[2] || 0;
                    attribute.y2 = setting[3] || 0;
                    break;

                case "rect":
                    attribute.x = setting[0] || 0;
                    attribute.y = setting[1] || 0;
                    attribute.width = setting[2] || 0;
                    attribute.height = setting[3] || 0;
                    break;

                case "use":
                    attribute.href = `#${setting[0]}`;
                    attribute.x = setting[1] || 0;
                    attribute.y = setting[2] || 0;
                    break;
            }

            // create the shape
            const shape = document.createElementNS("http://www.w3.org/2000/svg", type);
            Object.entries(attribute).forEach(elem => shape.setAttribute(...elem));
            return shape;
        }

        // get new id
        #getNewId(head) {
            let i = 0;
            let id = `${head}_${i}`;
            while (document.getElementById(id)) {
                i++;
                id = `${head}_${i}`;
            }
            return id;
        }

        // erase elements from their own drawing layer
        #eraseLayer(elements) {
            elements.filter(elem => elem.parentElement).forEach(elem => elem.parentElement.removeChild(elem));
        }

        // remove elements with the same id from the svg
        #removeIds(ids) {
            const escapes = ids.map(elem => elem.replace(/\W/g, "\\$&"));
            const elements = escapes.map(elem => this.#svg.querySelector(`#${elem}`)).filter(elem => elem);
            this.#eraseLayer(elements);
        }

    }

    // Common Part of orbit generator class
    class GeneratorCommon {

        // constructor
        constructor() {
            this.widths = new Array(36).fill(10).map((val, idx) => Math.max(val, idx + 5) / 10);
            this.divisions = this.widths.map(elem => Math.round(12 / elem));
            this.max = 0;
            this.scale = 1;
        }

        // whether it is valid prop data
        isValidProp(prop, sync) {
            // time of first throw
            if (isNaN(prop.start) || prop.start < 0) {
                return false;
            }

            // length of one cycle
            if (isNaN(prop.length) || prop.length < 0) {
                return false;
            }

            // throw height
            if (!Array.isArray(prop.numbers) || prop.numbers.length != prop.length) {
                return false;
            }
            if (prop.numbers.some(elem => isNaN(elem) || elem == 0)) {
                return false;
            }
            if (!sync && prop.numbers.some(elem => elem < 0)) {
                return false;
            }

            // time to throw
            if (!Array.isArray(prop.times) || prop.times.length != prop.length) {
                return false;
            }
            if (prop.times.some(elem => isNaN(elem) || elem < 1)) {
                return false;
            }
            return true;
        }

        // create an elliptical path
        createEllipsePath(sx, sy, ex, ey, dir) {
            // in ellipse x^2/a^2 + y^2/b^2 = 1, let b = 2/3 a (since it is basically ey = sy, a = length / 2 holds)
            const dx = ex - sx;
            const dy = ey - sy;
            const length = Math.sqrt(dx * dx + dy * dy);
            const a = -Math.sign(dx) * length / 2;
            const b = a * 2 / 3;

            // control points of the Bezier curve are (a,0), (a,h), (-a,h), (-a,0), since h = 4/3 b, dir = -1 for counterclockwise
            const h = dir * b * 4 / 3;
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", `M ${sx},${sy} c 0,${h} ${dx},${dy + h} ${dx},${dy}`);
            return path;
        }

        // create a list of coordinates along the path
        createPathPoints(moves, offset) {
            const convert = elem => new DOMPoint(elem.x + offset.x, elem.y + offset.y);
            const division = this.divisions[this.max];
            const arms = [];
            const prop = [];
            for (const paths of moves) {
                // full arm orbit
                const points = [];
                for (const path of paths) {
                    const orbit = [];
                    const delta = path.getTotalLength() / division;
                    let distance = 0;
                    for (let i = 0; i <= division; i++) {
                        orbit.push(path.getPointAtLength(distance));
                        distance += delta;
                    }
                    points.push(orbit);
                }
                arms.push(points);

                // prop orbit
                if (0 < points.length) {
                    prop.push(points[0].map(convert));
                }
            }
            return { "arms": arms, "prop": prop };
        }

        // create a coordinate list for a parabolic orbit
        createParabolaPoints(s, e, h, div) {
            // transform parabola y = h/(w^2) (x - v)^2 - h passing through (v - w, 0), (v, -h), (v + w, 0) so that it passes through (sx, sy), (ex, ey)
            h = h || 0.01;
            div = div || 1;
            const w = (e.x - s.x) / 2 || 0.01;
            const v = (e.x + s.x) / 2;
            const t = (e.y - s.y) / 2;
            const u = (e.y + s.y) / 2;

            // y = h/(w^2) (x - v + tw/2h)^2 - h + u - t^2/4h
            const a = h / (w * w);
            const b = v - t * w / (2 * h);
            const c = -h + u - (t * t) / (4 * h);

            // y = a (x - b)^2 + c
            let x = s.x;
            const dx = w * 2 / div;
            const points = [];
            for (let i = 0; i < div; i++) {
                const y = a * (x - b) * (x - b) + c;
                points.push(new DOMPoint(x, y));
                x += dx;
            }
            return points;
        }

        // get the greatest common divisor
        getGcd(a, b) {
            while (0 < b) {
                [ a, b ] = [ b, a % b ];
            }
            return a;
        }

        // get the lowest common multiple
        getLcm(a, b) {
            return a * b / this.getGcd(a, b);
        }

    }

    // Orbit generator base class
    class GeneratorBase {
        #common;
        #resolution = 1;

        // constructor
        constructor(common, resolution) {
            this.#common = common;
            this.resolution = resolution;

            // orbit of the joint
            this.paths = {};
            this.paths.right = [
                [
                    this.#common.createEllipsePath(-90, 10, -30, 10, -1),
                    this.#common.createEllipsePath(-70, -30, -50, -30, -1),
                ],
                [
                    this.#common.createEllipsePath(-30, 10, -90, 10, -1),
                    this.#common.createEllipsePath(-50, -30, -70, -30, -1),
                ],
            ];
            this.paths.left = [
                [
                    this.#common.createEllipsePath(90, 10, 30, 10, 1),
                    this.#common.createEllipsePath(70, -30, 50, -30, 1),
                ],
                [
                    this.#common.createEllipsePath(30, 10, 90, 10, 1),
                    this.#common.createEllipsePath(50, -30, 70, -30, 1),
                ],
            ];

            // prop offset relative to hand
            this.offset = { "right": new DOMPoint(0, -10), "left": new DOMPoint(0, -10) };
        }

        // get screen scale
        get scale() {
            return this.#common.scale;
        }

        // get line width
        get width() {
            return this.#common.widths[this.#common.max];
        }

        // get resolution
        get resolution() {
            return this.#resolution;
        }

        // set resolution
        set resolution(value) {
            const number = parseFloat(value);
            if (isNaN(number) || number <= 0) {
                return;
            }
            this.#resolution = number;
            this.#common.divisions = this.#common.widths.map(elem => Math.max(1, Math.round(number * 12 / elem)));
            this.#common.max = 0;
            this.#common.scale = 1;
        }

        // calculate orbits (template method)
        calculateOrbits(table, sync, throws) {
            return { "props": [], "arms": [] };
        }

    }

    // Basic orbit generator class
    class BasicGenerator extends GeneratorBase {
        #common;

        // constructor
        constructor(resolution) {
            const common = new GeneratorCommon();
            super(common, resolution);
            this.#common = common;
        }

        // calculate orbits
        calculateOrbits(table, sync, throws) {
            const state = { "props": [], "arms": [] };
            if (!Array.isArray(table) || table.some(elem => !this.#common.isValidProp(elem, sync))) {
                return state;
            }

            // get the contained numbers.
            const numbers = new Set(table.map(elem => elem.numbers).flat());
            this.#common.max = Array.from(numbers).reduce((acc, cur) => Math.max(acc, Math.abs(cur)), 5);
            this.#common.scale = (this.#common.max - 1) / 4;

            // a list of coordinates along the path
            const orbit = {};
            orbit.right = this.#common.createPathPoints(this.paths.right, this.offset.right);
            orbit.left = this.#common.createPathPoints(this.paths.left, this.offset.left);

            // a list of coordinates for each prop
            state.props = table.map(elem => this.#getPropStates(elem, orbit.right.prop, orbit.left.prop, sync));
            state.arms.push(this.#getArmStates(orbit.right.arms, false));
            state.arms.push(this.#getArmStates(orbit.left.arms, !sync));
            return state;
        }

        // get a list of prop states
        #getPropStates(prop, right, left, sync) {
            const division = this.#common.divisions[this.#common.max];
            const states = { "init": [], "loop": [] };
            let forward = right;
            let opposite = left;

            // before start
            let lag = prop.start % 2;
            if (lag == 1) {
                [ forward, opposite ] = [ opposite, forward ];
                if (!sync) {
                    states.init = states.init.concat(new Array(division).fill(forward[0][0]));
                }
            }

            // initial operation
            let time = prop.start;
            for (let i = 0; i < time - lag; i++) {
                states.init = states.init.concat(forward[i % forward.length].slice(0, division));
            }

            // tweak
            const half = Math.floor(division / 2);
            let prev = prop.numbers[prop.length - 1];
            if (prev == 1) {
                states.init = states.init.concat(forward[time % forward.length].slice(0, half));
            }

            // repetitive motion
            let index = (time - lag) % forward.length;
            const lcm = this.#common.getLcm(right.length, left.length);
            const count = lcm / this.#common.getGcd(prop.length, lcm);
            for (let i = 0; i < count; i++) {
                for (let j = 0; j < prop.length; j++) {
                    const number = prop.numbers[j];
                    let start = division;
                    let end = 0;
                    if (number == 1) {
                        start = half;
                        end = half;
                    }

                    // an orbit from catch to throw
                    if (prev == 1) {
                        states.loop = states.loop.concat(forward[index].slice(half, start));
                    } else {
                        states.loop = states.loop.concat(forward[index].slice(0, start));
                    }

                    // parabolic orbit from throw to catch
                    if (number == 2) {
                        states.loop = states.loop.concat(forward[(index + 1) % forward.length].slice(0, division));
                        time += 2;
                        index = (time - lag) % forward.length;
                    } else {
                        const from = forward[index][start];
                        const abs = Math.abs(number);
                        if (prop.times[j] % 2 == 1) {
                            // when throwing to the opposite hand
                            [ forward, opposite ] = [ opposite, forward ];
                            if (!sync) {
                                lag = 1 - lag;
                            }
                        }
                        time += abs;
                        index = (time - lag) % forward.length;
                        const to = forward[index][end];
                        const air = Math.max(1, abs - 1);
                        const height = air * air * 15 / this.scale;
                        const points = this.#common.createParabolaPoints(from, to, height, air * division);
                        states.loop = states.loop.concat(points);
                    }
                    prev = number;
                }
            }
            return states;
        }

        // get a list of arm states
        #getArmStates(orbits, gap) {
            const division = this.#common.divisions[this.#common.max];
            const states = [];
            const first = orbits[0];
            for (let i = 0; i < first.length; i++) {
                states.push({ "init": [], "loop": [] });
                if (gap) {
                    // before start
                    states[i].init = states[i].init.concat(new Array(division).fill(first[i][0]));
                }
            }
            for (const move of orbits) {
                // repetitive motion
                for (let i = 0; i < move.length; i++) {
                    states[i].loop = states[i].loop.concat(move[i].slice(0, division));
                }
            }
            return states;
        }

    }

    // Calm orbit generator class
    class CalmGenerator extends GeneratorBase {
        #common;

        // constructor
        constructor(resolution) {
            const common = new GeneratorCommon();
            super(common, resolution);
            this.#common = common;
        }

        // calculate orbits
        calculateOrbits(table, sync, throws) {
            const state = { "props": [], "arms": [] };
            if (!Array.isArray(table) || table.some(elem => !this.#common.isValidProp(elem, sync))) {
                return state;
            }
            if (!Array.isArray(throws) || throws.length == 0) {
                return state;
            }
            if (throws.some(elem => !Array.isArray(elem) || elem.length == 0 || elem.some(val => isNaN(val) || val < 0))) {
                return state;
            }

            // get the contained numbers.
            const numbers = new Set(table.map(elem => elem.numbers).flat());
            this.#common.max = Array.from(numbers).reduce((acc, cur) => Math.max(acc, Math.abs(cur)), 5);
            this.#common.scale = (this.#common.max - 1) / 4;

            // a list of coordinates along the path
            const orbit = {};
            orbit.right = this.#createPathPoints(this.paths.right, this.offset.right);
            orbit.left = this.#createPathPoints(this.paths.left, this.offset.left);

            // a list of coordinates for each prop
            const timing = this.#createTimings(throws, sync);
            state.props = table.map(elem => this.#getPropStates(elem, orbit.right.prop, orbit.left.prop, timing, sync));
            state.arms.push(this.#getArmStates(orbit.right.arms, timing, 0, false));
            state.arms.push(this.#getArmStates(orbit.left.arms, timing, 1, !sync));
            return state;
        }

        // create timings to throw
        #createTimings(throws, sync) {
            const timing = new Array(throws.length).fill().map(() => []);
            for (let i = 0; i < throws.length; i++) {
                for (const number of throws[i]) {
                    if (0 < number) {
                        if (sync && number % 2 == 1) {
                            timing[i].push(-(number + (i % 2) * 2 - 1));
                        } else {
                            timing[i].push(number);
                        }
                    }
                }
            }
            if (throws.length % 2 == 0) {
                return timing;
            }
            return timing.concat(timing);
        }

        // create a list of coordinates along the path
        #createPathPoints(moves, offset) {
            const division = this.#common.divisions[this.#common.max];
            const orbit = this.#common.createPathPoints(moves, offset);
            const arms = { "move": orbit.arms, "calm": [], "length": moves.length };
            const prop = { "move": orbit.prop, "calm": [], "length": moves.length };
            const first = orbit.arms.find(elem => 0 < elem.length);
            if (first != null) {
                arms.calm = first.map(elem => new Array(division).fill(elem[0]));
                prop.calm = new Array(division).fill(orbit.prop[0][0]);
            }
            return { "arms": arms, "prop": prop };
        }

        // get a list of prop states
        #getPropStates(prop, right, left, timing, sync) {
            const division = this.#common.divisions[this.#common.max];
            const states = { "init": [], "loop": [] };
            let forward = right;
            let opposite = left;

            // before start
            let lag = prop.start % 2;
            if (lag == 1) {
                [ forward, opposite ] = [ opposite, forward ];
                if (!sync) {
                    states.init = states.init.concat(forward.calm);
                }
            }

            // initial operation
            const half = Math.floor(division / 2);
            const rest = division - half;
            let time = prop.start;
            let tick = time;
            for (let i = 0; i < time - lag; i++) {
                const curr = i - i % 2 + lag;
                const busy = timing[curr % timing.length].some(elem => elem != 2);
                const zip = timing[(curr - 1 + timing.length) % timing.length].some(elem => elem == 1);
                const pos = i % forward.length;
                if (busy) {
                    states.init = states.init.concat(forward.move[pos].slice(0, division));
                } else if (zip && pos == 0) {
                    const first = forward.move[pos].slice(0, half);
                    const second = forward.move[pos].slice(0, rest).reverse();
                    states.init = states.init.concat(first).concat(second);
                } else {
                    states.init = states.init.concat(forward.calm);
                }
            }

            // tweak
            let prev = prop.numbers[prop.length - 1];
            if (prev == 1) {
                states.init = states.init.concat(forward.move[time % forward.length].slice(0, half));
            }

            // repetitive motion
            let index = (time - lag) % forward.length;
            const lcm = this.#common.getLcm(forward.length, opposite.length);
            const count = lcm / this.#common.getGcd(prop.length, lcm);
            for (let i = 0; i < count; i++) {
                for (let j = 0; j < prop.length; j++) {
                    const number = prop.numbers[j];
                    let start = division;
                    let end = 0;
                    if (number == 1) {
                        start = half;
                        end = half;
                    }
                    const busy = timing[tick % timing.length].some(elem => elem != 2);
                    const zip = timing[(tick - 1 + timing.length) % timing.length].some(elem => elem == 1);

                    // an orbit from catch to throw
                    if (prev == 1) {
                        if (busy) {
                            states.loop = states.loop.concat(forward.move[index].slice(half, start));
                        } else {
                            states.loop = states.loop.concat(forward.move[index].slice(end, rest).reverse());
                        }
                    } else {
                        if (busy || zip) {
                            states.loop = states.loop.concat(forward.move[index].slice(0, start));
                        } else {
                            states.loop = states.loop.concat(forward.calm);
                        }
                    }

                    // parabolic orbit from throw to catch
                    if (number == 2) {
                        if (busy) {
                            states.loop = states.loop.concat(forward.move[(index + 1) % forward.length].slice(0, division));
                        } else {
                            states.loop = states.loop.concat(forward.calm);
                        }
                        time += 2;
                        tick += 2;
                        index = (time - lag) % forward.length;
                    } else {
                        const from = forward.move[index][start];
                        const abs = Math.abs(number);
                        if (prop.times[j] % 2 == 1) {
                            // when throwing to the opposite hand
                            [ forward, opposite ] = [ opposite, forward ];
                            if (!sync) {
                                lag = 1 - lag;
                            }
                        }
                        time += abs;
                        tick += prop.times[j];
                        index = (time - lag) % forward.length;
                        const to = forward.move[index][end];
                        const air = Math.max(1, abs - 1);
                        const height = air * air * 15 / this.#common.scale;
                        const points = this.#common.createParabolaPoints(from, to, height, air * division);
                        states.loop = states.loop.concat(points);
                    }
                    prev = number;
                }
            }
            return states;
        }

        // get a list of arm states
        #getArmStates(orbits, timing, lag, gap) {
            const division = this.#common.divisions[this.#common.max];
            const states = [];

            // before start
            for (let i = 0; i < orbits.calm.length; i++) {
                states.push({ "init": [], "loop": [] });
                if (gap) {
                    states[i].init = states[i].init.concat(orbits.calm[i]);
                }
            }

            // repetitive motion
            const loop = [];
            for (let i = lag; i < timing.length; i += 2) {
                if (timing[i].some(elem => elem != 2)) {
                    loop.push("busy");
                } else if (timing[(i - 1 + timing.length) % timing.length].some(elem => elem == 1)) {
                    loop.push("zip");
                } else {
                    loop.push("calm");
                }
            }

            // remove duplicates
            const period = loop.length;
            let stride = 1;
            let result = loop;
            while (result == loop && stride <= period / 2) {
                if (period % stride == 0) {
                    const unit = loop.slice(0, stride);
                    let valid = true;
                    let start = stride;
                    while (valid && start < period) {
                        valid = unit.every((val, idx) => val == loop[start + idx]);
                        start += stride;
                    }
                    if (valid) {
                        result = unit;
                    }
                }
                stride++;
            }

            // get the coordinates
            const half = Math.floor(division / 2);
            const rest = division - half;
            for (const text of result) {
                switch (text) {
                    case "busy":
                        for (const move of orbits.move) {
                            states.forEach((val, idx) => val.loop = val.loop.concat(move[idx].slice(0, division)));
                        }
                        break;
                    case "zip":
                        const first = orbits.move[0].map(elem => elem.slice(0, half));
                        const second = orbits.move[0].map(elem => elem.slice(0, rest).reverse());
                        states.forEach((val, idx) => val.loop = val.loop.concat(first[idx]).concat(second[idx]).concat(orbits.calm[idx]));
                        break;
                    default:
                        states.forEach((val, idx) => val.loop = val.loop.concat(new Array(orbits.length).fill(orbits.calm[idx]).flat()));
                        break;
                }
            }
            return states;
        }

    }

    // Props converter class
    class PropsConverter {

        // separate by prop
        separate(throws, sync) {
            if (!Array.isArray(throws) || throws.length == 0) {
                return [];
            }
            if (throws.some(elem => !Array.isArray(elem) || elem.length == 0 || elem.some(val => isNaN(val) || val < 0))) {
                return [];
            }

            // get data for one cycle
            let unit = throws.map(elem => elem.concat());
            if (unit.length % 2 == 1) {
                unit = unit.concat(throws.map(elem => elem.concat()));
            }

            // create a list of props
            const count = throws.flat().reduce((acc, cur) => acc + cur, 0);
            const table = this.#createTable(unit, count);
            return this.#createProps(table, unit.length, sync);
        }

        // create a throw table
        #createTable(unit, count) {
            const pattern = unit.map(numbers => numbers.filter(elem => elem != 0));

            // set the throw
            const leading = pattern.length * count;
            const total = leading * 2;
            const table = [];
            for (let i = 0; i < total; i++) {
                const numbers = pattern[i % pattern.length];
                const exist = table.filter(elem => elem.time == i);
                for (let j = 0; j < exist.length; j++) {
                    // prioritize fallen props
                    if (!numbers[j]) {
                        return [];
                    }
                    const prop = exist[j];
                    prop.row[i] = numbers[j];
                    prop.time += numbers[j];
                }
                for (let j = exist.length; j < numbers.length; j++) {
                    // set a new prop if it does not exist
                    const prop = { "time": i + numbers[j], "row": new Array(total).fill(0) };
                    prop.row[i] = numbers[j];
                    table.push(prop);
                }
            }

            // use only the second half of the cycle
            return table.map(elem => elem.row.slice(leading));
        }

        // create a list of props
        #createProps(table, length, sync) {
            const props = [];
            for (const row of table) {
                const prop = { "start": 0, "times": [], "numbers": [], "length": 0 };
                props.push(prop);

                // first position
                let start = 0;
                while (start < row.length && row[start] == 0) {
                    start++;
                }
                const first = row[start];
                prop.start = start;
                prop.times.push(first);
                prop.numbers.push(this.#getNumber(sync, first, start));

                // get repeating pattern
                let position = start + first;
                while (position < row.length) {
                    const number = row[position];
                    if (number == first && (position - prop.start) % length == 0) {
                        // end when returning to the beginning of the pattern
                        break;
                    }
                    prop.times.push(number);
                    prop.numbers.push(this.#getNumber(sync, number, position));
                    position += number;
                }
                prop.length = prop.times.length;
            }
            return props;
        }

        // get a number that represents the height
        #getNumber(sync, number, position) {
            if (!sync || number % 2 == 0) {
                return number;
            }

            // convert
            if (position % 2 == 0) {
                return -(number - 1);
            } else {
                return -(number + 1);
            }
        }

    }

    // Siteswap analyzer class
    class SiteswapAnalyzer {
        #parser;

        // constructor
        constructor() {
            this.#parser = new SiteswapParser();
        }

        // run analysis
        analyze(text) {
            // lexical analysis
            const pattern = this.#getPattern(`${text}`);
            const lex = this.#parser.tokenize(pattern);
            if (!lex.tokens) {
                return { "valid": false, "message": `unknown character(s): ${lex.invalid}` };
            }

            // syntactic analysis
            const syntax = this.#parser.parse(lex.tokens);
            if (!syntax.tree) {
                return { "valid": false, "message": `syntax error: ${syntax.invalid}` };
            }

            // pattern analysis
            const result = this.#validateTree(syntax.tree);
            if (!result.text) {
                result.text = pattern;
            }
            if (!result.valid) {
                result.message = "impossible to juggle";
            }
            return result;
        }

        // convert to valid pattern
        #getPattern(text) {
            const hankaku = text => String.fromCharCode(text.charCodeAt(0) - 0xFEE0);
            const half = text.replace(/[\uFF01-\uFF5E]/g, hankaku);
            const quote = half.replace("\u2018", "`").replace("\u2019", "'").replace(/[\u201C\u201D]/g, "\"");
            const other = quote.replace("\u3000", " ").replace("\u301C", "~").replace("\uFFE5", "\u00A5");
            return other.toLowerCase();
        }

        // validate the tree
        #validateTree(tree) {
            const root = tree.children[0];

            // asynchronous siteswap
            if (root.label == "Async") {
                return this.#validateAsync(root);
            }

            // synchronous siteswap
            const term = root.children.pop();
            if (term.text == "*") {
                // mirror pattern
                const follow = [];
                for (const both of root.children) {
                    const nodes = [ both.children[0], both.children[3], both.children[2], both.children[1], both.children[4] ];
                    const text = nodes.map(elem => elem.text).join("");
                    const mirror = new SiteswapTree(both.label, text);
                    mirror.children = nodes;
                    follow.push(mirror);
                }
                root.children = root.children.concat(follow);
            } else {
                root.children.push(term);
            }

            // validate the synchronous siteswap
            const result = this.#validateSync(root);
            result.text = root.children.map(elem => elem.text).join("");
            return result;
        }

        // validate the asynchronous siteswap
        #validateAsync(tree) {
            // convert to array of numeric arrays
            const throws = [];
            for (const child of tree.children) {
                const props = [];
                const each = child.children[0];
                if (each.label == "AsyncMulti") {
                    // multiplex pattern
                    let zero = false;
                    for (let i = 1; i < each.children.length - 1; i++) {
                        const number = parseInt(each.children[i].text, 36);
                        if (number == 0) {
                            zero = true;
                        } else {
                            props.push(number);
                        }
                    }
                    if (props.length == 0 && zero) {
                        props.push(0);
                    }
                } else {
                    // uniplex pattern
                    props.push(parseInt(each.text, 36));
                }
                throws.push(props);
            }

            // validate the array of numeric arrays
            return this.#validateNumbers(throws, 1);
        }

        // validate the synchronous siteswap
        #validateSync(tree) {
            // convert to array of numeric arrays
            const throws = [];
            for (const both of tree.children) {
                for (let side = 0; side <= 1; side++) {
                    const props = [];
                    const one = both.children[side * 2 + 1].children[0];
                    if (one.label == "SyncMulti") {
                        // multiplex pattern
                        let zero = false;
                        for (let i = 1; i < one.children.length - 1; i++) {
                            const number = this.#convertSyncBeat(one.children[i], side);
                            if (number == 0) {
                                zero = true;
                            } else {
                                props.push(number);
                            }
                        }
                        if (props.length == 0 && zero) {
                            props.push(0);
                        }
                    } else {
                        // uniplex pattern
                        props.push(this.#convertSyncBeat(one, side));
                    }
                    throws.push(props);
                }
            }

            // validate the array of numeric arrays
            return this.#validateNumbers(throws, 2);
        }

        // convert a synchronous siteswap beat
        #convertSyncBeat(simple, side) {
            // without x
            if (simple.children.length <= 1) {
                return parseInt(simple.text, 36);
            }

            // with x
            const number = parseInt(simple.children[0].text, 36);
            if (number == 0) {
                return number;
            }
            if (side == 0) {
                return number + 1;
            } else {
                return number - 1;
            }
        }

        // validate the array of numeric arrays
        #validateNumbers(throws, unit) {
            const result = { "valid": false, "count": 0, "period": 0, "throws": [], "state": [], "sync": unit == 2 };
            const length = throws.length;
            const drops = new Array(length).fill(0);
            throws.forEach((val, idx) => val.forEach(elem => drops[(elem + idx) % length]++));
            if (drops.some((val, idx) => val != throws[idx].length)) {
                return result;
            }

            // set result
            result.valid = true;
            result.count = throws.flat().reduce((acc, cur) => acc + cur) / length;
            result.period = length;
            result.throws = throws;

            // calculate the period
            const half = Math.floor(length / 2);
            let period = unit;
            while (period <= half) {
                // check half the length from the beginning
                if (length % period == 0) {
                    const sub = JSON.stringify(throws.slice(0, period));
                    let start = period;
                    let valid = true;
                    while (valid && start < length) {
                        const end = start + period;
                        valid = sub == JSON.stringify(throws.slice(start, end));
                        start = end;
                    }
                    if (valid) {
                        result.period = period;
                        break;
                    }
                }
                period += unit;
            }

            // set state
            const max = throws.flat().reduce((acc, cur) => Math.max(acc, cur));
            if (max == 0) {
                result.state.push(0);
                return result;
            }
            const width = Math.ceil(max / length) * length;
            const state = new Array(width + max).fill(0);
            for (let i = 0; i < width; i += length) {
                throws.forEach((val, idx) => val.forEach(elem => state[i + idx + elem]++));
            }
            while (state[state.length - 1] == 0) {
                state.pop();
            }
            result.state = state.slice(width);
            return result;
        }

    }

    // Siteswap parser class
    class SiteswapParser {
        #terminals;
        #dummies;
        #elements;
        #rules = [];
        #table = [];

        // constructor
        constructor() {
            // terminal symbols
            const terms = SiteswapGrammar.terminals.concat(SiteswapGrammar.dummies);
            this.#terminals = terms.map(this.#quoteSingle);
            this.#dummies = SiteswapGrammar.dummies.map(this.#quoteSingle);
            this.#elements = terms.map(elem => new RegExp(`^(${elem})`, SiteswapGrammar.flag));

            // production rules
            const nonterms = [];
            for (let i = 0; i < SiteswapGrammar.rules.length; i++) {
                const pair = SiteswapGrammar.rules[i].split("=");
                const symbol = pair[0];
                this.#rules.push({ "symbol": symbol, "count": parseInt(pair[1], 10) });
                if (0 < i && !nonterms.includes(symbol)) {
                    // non-terminal symbols
                    nonterms.push(symbol);
                }
            }
            nonterms.unshift("$");
            const symbols = SiteswapGrammar.terminals.map(this.#quoteSingle).concat(nonterms);

            // parsing table
            for (const line of SiteswapGrammar.table) {
                const row = {};
                for (let i = 0; i < symbols.length; i++) {
                    const match = line[i].match(/^(s|r|g)([0-9]+)$/);
                    if (match) {
                        const symbol = match[1];
                        const number = parseInt(match[2], 10);
                        row[symbols[i]] = { "symbol": symbol, "number": number };
                    }
                }
                this.#table.push(row);
            }
        }

        // lexical analysis
        tokenize(text) {
            const tokens = [];
            while (0 < text.length) {
                const max = new SiteswapToken();
                for (let i = 0; i < this.#elements.length; i++) {
                    const result = this.#elements[i].exec(text);
                    if (result && max.length < result[0].length) {
                        // get the longest and the first token
                        max.setPattern(this.#terminals[i], result[0]);
                    }
                }
                if (0 < max.length) {
                    // found a token
                    if (!this.#dummies.includes(max.label)) {
                        tokens.push(max);
                    }
                    text = text.substring(max.length);
                } else {
                    // not found a token
                    break;
                }
            }

            // get the result
            if (0 < text.length) {
                const valid = tokens.map(elem => elem.text).join(" ");
                return { "tokens": null, "valid": valid.trim(), "invalid": text };
            }
            return { "tokens": tokens };
        }

        // syntactic analysis
        parse(tokens) {
            const stack = new SiteswapStack();

            // dealing all tokens
            tokens.push(new SiteswapToken("$"));
            while (0 < tokens.length) {
                const next = tokens[0];
                const label = next.label;

                // execute an action
                const action = this.#table[stack.peekState()][label];
                if (!action) {
                    break;
                }
                if (action.symbol == "s") {
                    // shift
                    const leaf = new SiteswapTree(label, next.text);
                    stack.push(leaf, action.number);
                    tokens.shift();
                } else {
                    // reduce
                    const rule = this.#rules[action.number];
                    let nodes = [];
                    for (let i = 0; i < rule.count; i++) {
                        const top = stack.popTree();
                        if (top.label.charAt(0) == "#") {
                            // a non-terminal symbol that should be removed
                            nodes = top.children.concat(nodes);
                        } else {
                            nodes.unshift(top);
                        }
                    }

                    // create a syntax tree
                    const node = new SiteswapTree(rule.symbol);
                    node.children = nodes;
                    if (SiteswapConverter[node.label]) {
                        SiteswapConverter[node.label](node);
                    }

                    // accept
                    if (action.number == 0) {
                        return { "tree": node.children[0] };
                    }

                    // transit
                    const goto = this.#table[stack.peekState()][node.label];
                    if (!goto) {
                        break;
                    }
                    stack.push(node, goto.number);
                }
            }

            // the case of not to accept
            let valid = "";
            while (0 < stack.count) {
                valid = `${this.#joinTree(stack.popTree())} ${valid}`;
            }
            const invalid = tokens.map(elem => elem.text).join(" ");
            return { "tree": null, "valid": valid.trim(), "invalid": invalid.trim() };
        }

        // add the single quatations
        #quoteSingle(text) {
            const plain = text.replace(/\\(.)/g, "$1");
            return `'${plain}'`;
        }

        // join the tree strings
        #joinTree(tree) {
            if (tree.text != "") {
                return tree.text;
            }
            return tree.children.map(this.#joinTree, this).join(" ");
        }

    }

    // Siteswap token class
    class SiteswapToken {

        // constructor
        constructor(label) {
            this.setPattern(label, "");
        }

        // set the pattern
        setPattern(label, text) {
            this.label = label || "";
            this.text = text || "";
            this.length = text.length;
        }

    }

    // Siteswap tree class
    class SiteswapTree {

        // constructor
        constructor(label, text) {
            this.label = label || "";
            this.text = text || "";
            this.children = [];
        }

    }

    // Siteswap state stack class
    class SiteswapStack {
        #stack = [];

        // get the number of the stack items
        get count() {
            return this.#stack.length;
        }

        // push a state pair to the stack top
        push(tree, state) {
            const pair = { "tree": tree, "state": state };
            this.#stack.push(pair);
        }

        // pop a state pair from the stack top, remove it, and return the tree
        popTree() {
            const last = this.#stack.length - 1;
            if (last < 0) {
                return null;
            } else {
                const pair = this.#stack.pop();
                return pair.tree;
            }
        }

        // peek the state number of the stack top
        peekState() {
            const last = this.#stack.length - 1;
            if (last < 0) {
                return 0;
            } else {
                return this.#stack[last].state;
            }
        }

    }

    // Siteswap grammar
    const SiteswapGrammar = {

        "flag": "i",

        "terminals": [
            "x",
            "\\[",
            "\\]",
            "\\*",
            "\\(",
            ",",
            "\\)",
            "[02468acegikmoqsuwy]",
            "[13579bdfhjlnprtvz]",
        ],

        "dummies": [
            "\\s+",
        ],

        "rules": [
            "#0#=1",
            "Pattern=1",
            "#1#=1",
            "#1#=1",
            "Async=1",
            "#2#=2",
            "#2#=1",
            "EachHand=1",
            "#3#=1",
            "#3#=1",
            "AsyncSimple=1",
            "#4#=1",
            "#4#=1",
            "Even=1",
            "Odd=1",
            "#5#=1",
            "#5#=1",
            "AsyncMulti=3",
            "#6#=2",
            "#6#=1",
            "Sync=2",
            "#7#=2",
            "#7#=1",
            "#8#=1",
            "#8#=0",
            "BothHand=5",
            "OneHand=1",
            "#9#=1",
            "#9#=1",
            "SyncSimple=2",
            "#10#=1",
            "#10#=0",
            "SyncMulti=3",
            "#11#=2",
            "#11#=1",
        ],

        "table": [
            [ "s14", "s16", "", "", "s27", "", "", "s10", "s13", "", "g1", "g2", "g3", "g4", "g21", "g6", "g7", "g8", "g9", "g11", "g12", "g15", "", "g22", "g23", "", "g43", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "r0", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "r1", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "r2", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "s14", "s16", "", "", "", "", "", "s10", "s13", "r4", "", "", "", "", "g5", "g6", "g7", "g8", "g9", "g11", "g12", "g15", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r5", "r5", "", "", "", "", "", "r5", "r5", "r5", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r7", "r7", "", "", "", "", "", "r7", "r7", "r7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r8", "r8", "", "", "", "", "", "r8", "r8", "r8", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r10", "r10", "r10", "", "", "", "", "r10", "r10", "r10", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r11", "r11", "r11", "", "", "", "", "r11", "r11", "r11", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r13", "r13", "r13", "", "", "r13", "r13", "r13", "r13", "r13", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r12", "r12", "r12", "", "", "", "", "r12", "r12", "r12", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r14", "r14", "r14", "", "", "", "", "r14", "r14", "r14", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r15", "r15", "r15", "", "", "", "", "r15", "r15", "r15", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r16", "r16", "r16", "", "", "", "", "r16", "r16", "r16", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r9", "r9", "", "", "", "", "", "r9", "r9", "r9", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "s14", "", "", "", "", "", "", "s10", "s13", "", "", "", "", "", "", "", "g20", "g8", "g9", "g11", "g12", "", "g17", "", "", "", "", "", "", "", "", "", "" ],
            [ "s14", "", "s18", "", "", "", "", "s10", "s13", "", "", "", "", "", "", "", "g19", "g8", "g9", "g11", "g12", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r17", "r17", "", "", "", "", "", "r17", "r17", "r17", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r18", "", "r18", "", "", "", "", "r18", "r18", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r19", "", "r19", "", "", "", "", "r19", "r19", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r6", "r6", "", "", "", "", "", "r6", "r6", "r6", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "r3", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "s25", "s27", "", "", "", "", "r24", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "g24", "g26", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "r20", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "r23", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "r21", "r21", "", "", "", "", "r21", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "s38", "", "", "", "", "", "s10", "", "", "", "", "", "", "", "", "", "", "g34", "", "", "", "", "", "", "", "", "g28", "g32", "g33", "", "g37", "" ],
            [ "", "", "", "", "", "s29", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "s38", "", "", "", "", "", "s10", "", "", "", "", "", "", "", "", "", "", "g34", "", "", "", "", "", "", "", "", "g30", "g32", "g33", "", "g37", "" ],
            [ "", "", "", "", "", "", "s31", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "r25", "r25", "", "", "", "", "r25", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "r26", "r26", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "r27", "r27", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "s36", "", "r31", "", "", "r31", "r31", "r31", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "g35", "", "" ],
            [ "", "", "r29", "", "", "r29", "r29", "r29", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "r30", "", "", "r30", "r30", "r30", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "r28", "r28", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "s10", "", "", "", "", "", "", "", "", "", "", "g34", "", "", "", "", "", "", "", "", "", "", "g42", "", "", "g39" ],
            [ "", "", "s40", "", "", "", "", "s10", "", "", "", "", "", "", "", "", "", "", "g34", "", "", "", "", "", "", "", "", "", "", "g41", "", "", "" ],
            [ "", "", "", "", "", "r32", "r32", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "r33", "", "", "", "", "r33", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "r34", "", "", "", "", "r34", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "r22", "r22", "", "", "", "", "r22", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
        ],

    }

    // Siteswap converter
    const SiteswapConverter = {

        // Pattern ::= Async | Sync ;
        "Pattern": function(tree) {
            SiteswapConverter._setText(tree);
        },

        // Async ::= EachHand+ ;
        "Async": function(tree) {
            SiteswapConverter._joinText(tree);
        },

        // EachHand ::= AsyncSimple | AsyncMulti ;
        "EachHand": function(tree) {
            SiteswapConverter._setText(tree);
        },

        // AsyncSimple ::= Even | Odd ;
        "AsyncSimple": function(tree) {
            SiteswapConverter._setText(tree);
        },

        // Even ::= "[02468acegikmoqsuwy]" ;
        "Even": function(tree) {
            SiteswapConverter._setText(tree);
        },

        // Odd ::= "[13579bdfhjlnprtvz]" | 'x' ;
        "Odd": function(tree) {
            SiteswapConverter._setText(tree);
        },

        // AsyncMulti ::= '[' AsyncSimple+ ']' ;
        "AsyncMulti": function(tree) {
            SiteswapConverter._joinText(tree);
        },

        // Sync ::= BothHand+ '*'? ;
        "Sync": function(tree) {
            SiteswapConverter._joinText(tree);
        },

        // BothHand ::= '(' OneHand ',' OneHand ')' ;
        "BothHand": function(tree) {
            SiteswapConverter._joinText(tree);
        },

        // OneHand ::= SyncSimple | SyncMulti ;
        "OneHand": function(tree) {
            SiteswapConverter._setText(tree);
        },

        // SyncSimple ::= Even 'x'? ;
        "SyncSimple": function(tree) {
            SiteswapConverter._joinText(tree);
        },

        // SyncMulti ::= '[' SyncSimple+ ']' ;
        "SyncMulti": function(tree) {
            SiteswapConverter._joinText(tree);
        },

        // set the text
        "_setText": function(tree) {
            tree.text = tree.children[0].text;
        },

        // join the text
        "_joinText": function(tree) {
            tree.text = tree.children.map(elem => elem.text).join("");
        },

    }

    // public classes
    parent.Facade = Facade;
    parent.Core = Core;
    parent.Animator = Animator;
    parent.BasicGenerator = BasicGenerator;
    parent.CalmGenerator = CalmGenerator;

    // public methods
    const analyzer = new SiteswapAnalyzer();
    const converter = new PropsConverter();
    parent.Siteswap = {};
    parent.Siteswap.analyze = analyzer.analyze.bind(analyzer);
    parent.Siteswap.separate = converter.separate.bind(converter);

})(jmotion);


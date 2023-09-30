// jmotion namespace
var jmotion = jmotion || {};
jmotion.VERSION = "1.0";
(function(parent) {

    // private data by class
    const privatePart = (function() {
        const map = new WeakMap();
        return function(key, value) {
            if (value) {
                map.set(key, value);
            }
            return map.get(key);
        }
    })();

    // Facade class for simulator
    const Facade = function(svg) {
        // properties
        const core = new jmotion.Core(svg);
        this.animator = new jmotion.Animator(core);
        this.creator = new jmotion.BasicCreator();
    }

    // Facade prototype for simulator
    Facade.prototype = {

        // start juggling simulator
        "startJuggling": function(text) {
            if (!text) {
                // pattern is not specified
                const status = this.animator.getStatus();
                if (!status.runnable) {
                    return "No data for animation.";
                }
                if (!status.running) {
                    this.animator.start(1);
                }
                return "";
            }

            // analyze the input value
            this.animator.stop();
            const result = jmotion.Siteswap.analyze(text);
            if (!result.valid) {
                return result.message;
            }

            // create coordinate list
            const table = jmotion.Siteswap.separate(result.throws, result.synch);
            const orbits = this.creator.calculateOrbits(table, result.synch);
            this.animator.props = orbits.props;
            this.animator.arms = orbits.arms;
            this.animator.core.setScale(this.creator.getScale());
            this.animator.core.setStyle({ "stroke-width": this.creator.getWidth() });

            // start animation
            this.animator.setIndex(0);
            this.animator.start(1);
            return "";
        },

        // stop juggling simulator
        "stopJuggling": function() {
            this.animator.stop();
        },

    }

    // Animation handling class (public part)
    const AnimatorPublic = function(core) {
        const private = privatePart(this, new AnimatorPrivate(this));

        // properties
        this.core = core;
        this.props = [];
        this.arms = [];
    }

    // Animation handling prototype (public part)
    AnimatorPublic.prototype = {

        // start animation
        "start": function(speed) {
            // check if it is running
            const private = privatePart(this);
            if (0 < private.moveId) {
                return;
            }
            if (isNaN(speed)) {
                private.speed = 1;
            } else {
                private.speed = speed;
            }

            // start
            private.moveId = setInterval(private.run.bind(private), private.interval);
        },

        // stop animation
        "stop": function() {
            // check if it is running
            const private = privatePart(this);
            if (private.moveId == 0) {
                return;
            }

            // stop
            clearInterval(private.moveId);
            private.moveId = 0;
        },

        // get running status
        "getStatus": function() {
            const private = privatePart(this);
            const running = 0 < private.moveId;
            const runnable = running || 0 < this.props.length || 0 < this.arms.length;
            return { "running": running, "runnable": runnable };
        },

        // get running index
        "getIndex": function() {
            const private = privatePart(this);
            return private.index;
        },

        // set running index
        "setIndex": function(index) {
            // get index
            const private = privatePart(this);
            if (isNaN(index)) {
                private.index = 0;
            } else {
                private.index = Math.max(0, index);
            }

            // draw shapes
            private.draw();
        },

    }

    // Animation handling class (private part)
    const AnimatorPrivate = function(public) {
        // properties
        this.public = public;
        this.interval = 40;
        this.moveId = 0;
        this.index = 0;
        this.speed = 1;
    }

    // Animation handling prototype (private part)
    AnimatorPrivate.prototype = {

        // draw continuously
        "run": function() {
            this.index += this.speed;
            this.draw();
        },

        // draw shapes
        "draw": function() {
            // get coordinates
            const index = Math.floor(this.index);
            if (index < 0) {
                return;
            }
            const props = this.getCurrent(this.public.props, index);
            const arms = this.public.arms.map(elem => this.getCurrent(elem, index));

            // draw props and arms separately
            this.public.core.drawProps(props);
            this.public.core.drawArms(arms);
        },

        // get current coordinates
        "getCurrent": function(moves, index) {
            const current = [];
            for (const move of moves) {
                if (index < move.init.length) {
                    current.push(move.init[index]);
                } else if (0 < move.loop.length) {
                    current.push(move.loop[(index - move.init.length) % move.loop.length]);
                }
            }
            return current;
        },

    }

    // Drawing core class (public part)
    const CorePublic = function(element, cancel) {
        const private = privatePart(this, new CorePrivate(this));

        // drawing area
        if (!(element instanceof SVGSVGElement)) {
            const div = element;
            element = private.getShape("svg", private.getNewId("jmotion_core"));
            if (div && typeof div.appendChild == "function") {
                // for the parent element
                div.appendChild(element);
            }
        }
        this.svg = element;

        // definition area
        const exists = this.svg.getElementsByTagName("defs");
        if (0 < exists.length) {
            this.defs = exists[0];
        } else {
            this.defs = private.getShape("defs", "definition");
            this.svg.appendChild(this.defs);
        }

        // layer
        this.back = private.getShape("g", "back");
        this.middle = private.getShape("g", "middle");
        this.front = private.getShape("g", "front");
        this.svg.appendChild(this.back);
        this.svg.appendChild(this.middle);
        this.svg.appendChild(this.front);

        // initial settings
        private.initialize(cancel);
        this.setStyle({ "fill": "white", "stroke": "black", "stroke-width": 1 });
        this.setScale(1);
    }

    // Drawing core prototype (public part)
    CorePublic.prototype = {

        // set body elements
        "setBody": function(elements, append, layer) {
            const private = privatePart(this);

            // select layer
            if (!layer) {
                layer = this.back;
            }
            if (!append) {
                // remove existing elements
                const children = Array.from(layer.children);
                const targets = children.filter(elem => private.hands.indexOf(elem) < 0 && private.arms.every(arm => arm.indexOf(elem) < 0));
                targets.forEach(layer.removeChild, layer);
            }
            if (!Array.isArray(elements)) {
                return;
            }

            // set to the layer
            elements.forEach(layer.appendChild, layer);
        },

        // set arm elements
        "setArms": function(arms, layer) {
            const private = privatePart(this);

            // select layer
            if (!layer) {
                layer = this.back;
            }

            // remove existing elements
            private.arms.forEach(private.eraseLayer, private);
            private.arms = [];
            if (!Array.isArray(arms)) {
                return;
            }

            // set to the layer
            for (const elements of arms) {
                if (Array.isArray(elements)) {
                    elements.forEach(layer.appendChild, layer);
                    private.arms.push(elements);
                }
            }
        },

        // set hand elements
        "setHands": function(elements, layer) {
            const private = privatePart(this);

            // select layer
            if (!layer) {
                layer = this.front;
            }

            // remove existing elements
            private.eraseLayer(private.hands);
            private.hands = [];
            if (!Array.isArray(elements)) {
                return;
            }

            // set to the layer
            for (let hand of elements) {
                if (!(hand instanceof SVGUseElement)) {
                    // if not SVGUseElement, convert to SVGUseElement
                    if (!hand.id) {
                        hand.id = private.getNewId(`${this.svg.id}_hand`);
                    }
                    this.defs.appendChild(hand);
                    hand = private.getShape("use", `${hand.id}_use`, [ hand.id ]);
                }
                layer.appendChild(hand);
                private.hands.push(hand);
            }
        },

        // set prop elements
        "setProps": function(elements) {
            const private = privatePart(this);

            // remove existing elements
            const targets = private.pool.map(document.getElementById, document).filter(elem => elem);
            targets.forEach(this.defs.removeChild, this.defs);
            private.props = [];
            private.pool = [];
            if (!Array.isArray(elements)) {
                return;
            }

            // set as the definition
            for (let i = 0; i < elements.length; i++) {
                const prop = elements[i];
                if (!prop.id) {
                    prop.id = private.getNewId(`${this.svg.id}_prop`);
                }
                private.pool.push(prop.id);
                this.defs.appendChild(prop);

                // use the definition
                const use = private.getShape("use", `prop_${i}`, [ prop.id ]);
                private.props.push(use);
            }
        },

        // set display style
        "setStyle": function(style, layer) {
            // get layer list
            const layers = [];
            if (layer) {
                if (Array.isArray(layer)) {
                    Array.prototype.push.apply(layers, layer);
                } else {
                    layers.push(layer);
                }
            } else {
                layers.push(this.back);
                layers.push(this.front);
            }

            // set styles for each element
            for (const name in style) {
                const value = style[name];
                layers.forEach(group => Array.from(group.children).forEach(elem => elem.setAttribute(name, value)));
            }
        },

        // set screen scale
        "setScale": function(scale) {
            // get real number
            const ratio = parseFloat(scale);
            if (isNaN(ratio) || ratio <= 0) {
                return;
            }

            // change scale
            const private = privatePart(this);
            const stride = private.area.width * ratio;
            this.svg.setAttribute("viewBox", `${-stride / 2} ${private.area.y * ratio} ${stride} ${stride}`);
        },

        // draw props
        "drawProps": function(props) {
            if (!Array.isArray(props)) {
                return;
            }

            // check if it has increased or decreased
            const private = privatePart(this);
            const diff = props.length - private.uses.length;
            if (diff < 0) {
                // decreased
                while (props.length < private.uses.length) {
                    this.middle.removeChild(private.uses.pop());
                }
            } else if (0 < diff) {
                // increased
                for (let i = private.props.length; i < props.length; i++) {
                    const id = private.pool[i % private.pool.length];
                    const prop = private.getShape("use", `prop_${i}`, [ id ]);
                    private.props.push(prop);
                }
                const before = private.uses.length;
                for (let i = before; i < props.length; i++) {
                    private.uses.push(private.props[i]);
                }

                // add to screen in reverse order
                for (let i = before; i < private.uses.length; i++) {
                    this.middle.insertBefore(private.uses[i], private.uses[i - 1]);
                }
            }

            // draw
            for (let i = 0; i < props.length; i++) {
                private.uses[i].setAttribute("x", props[i].x);
                private.uses[i].setAttribute("y", props[i].y);
            }
        },

        // draw arms
        "drawArms": function(arms) {
            if (!Array.isArray(arms)) {
                return;
            }

            // draw for each arm
            const private = privatePart(this);
            for (let i = 0; i < arms.length; i++) {
                const joints = arms[i];
                if (!Array.isArray(joints) || joints.length == 0) {
                    continue;
                }
                if (i < private.hands.length) {
                    // hand
                    private.hands[i].setAttribute("x", joints[0].x);
                    private.hands[i].setAttribute("y", joints[0].y);
                }
                if (i < private.arms.length) {
                    const lines = private.arms[i];
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
        },

    }

    // Drawing core class (private part)
    const CorePrivate = function(public) {
        // properties
        this.public = public;
        this.arms = [];
        this.hands = [];
        this.pool = [];
        this.props = [];
        this.uses = [];
    }

    // Drawing core prototype (private part)
    CorePrivate.prototype = {

        // initial setting
        "initialize": function(cancel) {
            // define shapes
            this.area = new DOMRect(-150, -255, 300, 300);
            if (cancel) {
                return;
            }

            // body
            const body = [
                this.getShape("circle", "head", [ 20, 0, -120 ]),
                this.getShape("line", "shoulder", [ -50, -90, 50, -90 ]),
            ];
            this.public.setBody(body);

            // hands
            const hand = this.getShape("rect", "hand", [ -10, 0, 20, 5 ]);
            this.public.defs.appendChild(hand);
            const hands = [
                this.getShape("use", "right_hand", [ hand.id, -90, 10 ]),
                this.getShape("use", "left_hand", [ hand.id, 90, 10 ]),
            ];
            this.public.setHands(hands);

            // arms
            const right = [
                this.getShape("line", "right_0", [ -90, 10, -70, -30 ]),
                this.getShape("line", "right_1", [ -70, -30, -50, -90 ]),
            ];
            const left = [
                this.getShape("line", "left_0", [ 90, 10, 70, -30 ]),
                this.getShape("line", "left_1", [ 70, -30, 50, -90 ]),
            ];
            this.public.setArms([ right, left ]);

            // props
            const props = [];
            const colors = [ "red", "lime", "blue", "orange", "gray", "maroon", "green", "aqua", "olive", "fuchsia", "teal", "yellow", "navy", "silver", "purple", "black" ];
            for (const color of colors) {
                const shape = this.getShape("circle", `prop_${color}`, [ 10 ]);
                shape.setAttribute("fill", color);
                props.push(shape);
            }
            this.public.setProps(props);
        },

        // get svg shape
        "getShape": function(type, id, setting) {
            // create attributes
            if (this.public.svg) {
                id = `${this.public.svg.id}_${id}`;
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
            for (const name in attribute) {
                shape.setAttribute(name, attribute[name]);
            }
            return shape;
        },

        // get new id
        "getNewId": function(head) {
            let i = 0;
            let id = `${head}_${i}`;
            while (document.getElementById(id)) {
                i++;
                id = `${head}_${i}`;
            }
            return id;
        },

        // erase elements from their own drawing layer
        "eraseLayer": function(elements) {
            for (const element of elements) {
                const parent = element.parentElement;
                if (parent) {
                    parent.removeChild(element);
                }
            }
        },

    }

    // Orbit creator class (public part)
    const CreatorPublic = function() {
        const private = privatePart(this, new CreatorPrivate(this));

        // orbit of the joint
        this.paths = {};
        this.paths.right = [
            [
                private.createEllipsePath(-90, 10, -30, 10, -1),
                private.createEllipsePath(-70, -30, -50, -30, -1),
            ],
            [
                private.createEllipsePath(-30, 10, -90, 10, -1),
                private.createEllipsePath(-50, -30, -70, -30, -1),
            ],
        ];
        this.paths.left = [
            [
                private.createEllipsePath(90, 10, 30, 10, 1),
                private.createEllipsePath(70, -30, 50, -30, 1),
            ],
            [
                private.createEllipsePath(30, 10, 90, 10, 1),
                private.createEllipsePath(50, -30, 70, -30, 1),
            ],
        ];

        // prop offset relative to hand
        this.offset = { "right": new DOMPoint(0, -10), "left": new DOMPoint(0, -10) };
    }

    // Orbit creator prototype (public part)
    CreatorPublic.prototype = {

        // calculate orbits
        "calculateOrbits": function(table, synch) {
            const private = privatePart(this);

            // check prop data
            const state = { "props": [], "arms": [] };
            if (!Array.isArray(table) || table.some(elem => !private.isValidProp(elem, synch))) {
                return state;
            }

            // get numbers in data
            const numbers = new Set();
            table.forEach(elem => elem.numbers.forEach(numbers.add, numbers));
            numbers.delete(2);

            // get scale
            const max = Array.from(numbers).reduce((acc, cur) => Math.max(acc, Math.abs(cur)), 5);
            private.scale = (max - 1) / 4;
            private.div = private.divisions[Math.min(max - 5, private.divisions.length - 1)];

            // a list of coordinates along the path
            const orbit = {};
            orbit.right = private.createPathPoints(this.paths.right, this.offset.right);
            orbit.left = private.createPathPoints(this.paths.left, this.offset.left);

            // a list of coordinates for each prop
            for (const prop of table) {
                state.props.push(private.getPropStates(prop, orbit.right.prop, orbit.left.prop, synch));
            }
            state.arms.push(private.getArmStates(orbit.right.arms, false));
            state.arms.push(private.getArmStates(orbit.left.arms, !synch));
            return state;
        },

        // get screen scale
        "getScale": function() {
            const private = privatePart(this);
            return private.scale;
        },

        // get line width
        "getWidth": function() {
            const private = privatePart(this);
            return private.divisions[0] / private.div;
        },

    }

    // Orbit creator class (private part)
    const CreatorPrivate = function(public) {
        // properties
        this.public = public;
        this.divisions = [ 12, 11, 10, 9, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3 ];
        this.scale = 1;
        this.div = this.divisions[0];
    }

    // Orbit creator prototype (private part)
    CreatorPrivate.prototype = {

        // whether it is valid prop data
        "isValidProp": function(prop, synch) {
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
            if (!synch && prop.numbers.some(elem => elem < 0)) {
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
        },

        // create an elliptical path
        "createEllipsePath": function(sx, sy, ex, ey, dir) {
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
        },

        // create a list of coordinates along the path
        "createPathPoints": function(moves, offset) {
            const convert = elem => new DOMPoint(elem.x + offset.x, elem.y + offset.y);
            const arms = [];
            const prop = [];
            for (const paths of moves) {
                // full arm orbit
                const points = [];
                for (const path of paths) {
                    const orbit = [];
                    const delta = path.getTotalLength() / this.div;
                    let distance = 0;
                    for (let i = 0; i <= this.div; i++) {
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
        },

        // get a list of prop states
        "getPropStates": function(prop, right, left, synch) {
            const states = { "init": [], "loop": [] };
            let forward = right;
            let opposite = left;

            // before start
            let lag = prop.start % 2;
            if (lag == 1) {
                [forward, opposite] = [opposite, forward];
                if (!synch) {
                    Array.prototype.push.apply(states.init, new Array(this.div).fill(forward[0][0]));
                }
            }

            // initial operation
            let time = prop.start;
            for (let i = 0; i < time - lag; i++) {
                Array.prototype.push.apply(states.init, forward[i % forward.length].slice(0, this.div));
            }

            // tweak
            const half = Math.floor(this.div / 2);
            let prev = prop.numbers[prop.length - 1];
            if (prev == 1) {
                Array.prototype.push.apply(states.init, forward[time % forward.length].slice(0, half));
            }

            // repetitive motion
            let index = (time - lag) % forward.length;
            const lcm = this.getLcm(right.length, left.length);
            const count = lcm / this.getGcd(prop.length, lcm);
            for (let i = 0; i < count; i++) {
                for (let j = 0; j < prop.length; j++) {
                    const number = prop.numbers[j];
                    let start = this.div;
                    let end = 0;
                    if (number == 1) {
                        start = half;
                        end = half;
                    }

                    // an orbit from catch to throw
                    if (prev == 1) {
                        Array.prototype.push.apply(states.loop, forward[index].slice(half, start));
                    } else {
                        Array.prototype.push.apply(states.loop, forward[index].slice(0, start));
                    }

                    // parabolic orbit from throw to catch
                    if (number == 2) {
                        Array.prototype.push.apply(states.loop, forward[(index + 1) % forward.length].slice(0, this.div));
                        time += 2;
                        index = (time - lag) % forward.length;
                    } else {
                        const from = forward[index][start];
                        const abs = Math.abs(number);
                        if (prop.times[j] % 2 == 1) {
                            // when throwing to the opposite hand
                            [forward, opposite] = [opposite, forward];
                            if (!synch) {
                                lag = 1 - lag;
                            }
                        }
                        time += abs;
                        index = (time - lag) % forward.length;
                        const to = forward[index][end];
                        const air = Math.max(1, abs - 1);
                        const height = air * air * 15 / this.scale;
                        const points = this.createParabolaPoints(from, to, height, air * this.div);
                        Array.prototype.push.apply(states.loop, points);
                    }
                    prev = number;
                }
            }
            return states;
        },

        // create a coordinate list for a parabolic orbit
        "createParabolaPoints": function(s, e, h, div) {
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
        },

        // get a list of arm states
        "getArmStates": function(orbits, lag) {
            const states = [];
            const first = orbits[0];
            for (let i = 0; i < first.length; i++) {
                states.push({ "init": [], "loop": [] });
                if (lag) {
                    // before start
                    Array.prototype.push.apply(states[i].init, new Array(this.div).fill(first[i][0]));
                }
            }
            for (const move of orbits) {
                // repetitive motion
                for (let i = 0; i < move.length; i++) {
                    Array.prototype.push.apply(states[i].loop, move[i].slice(0, this.div));
                }
            }
            return states;
        },

        // get the greatest common divisor
        "getGcd": function(a, b) {
            if (b == 0) {
                return a;
            }
            return this.getGcd(b, a % b);
        },

        // get the lowest common multiple
        "getLcm": function(a, b) {
            return a * b / this.getGcd(a, b);
        },

    }

    // Props converter class
    const PropsConverter = function() {
    }

    // Props converter prototype
    PropsConverter.prototype = {

        // separate by prop
        "separate": function(throws, synch) {
            // check siteswap array
            try {
                const negative = elem => isNaN(elem) || elem < 0;
                if (throws.length == 0 || throws.some(elem => elem.length == 0 || elem.some(negative))) {
                    return [];
                }
            } catch {
                return [];
            }

            // get data for one cycle
            const unit = throws.map(elem => elem.concat());
            if (unit.length % 2 == 1) {
                Array.prototype.push.apply(unit, throws.map(elem => elem.concat()));
            }

            // create a list of props
            const sum = (acc, cur) => acc + cur;
            const count = throws.reduce((acc, cur) => cur.reduce(sum, acc), 0);
            const table = this._createTable(unit, count);
            return this._createProps(table, unit.length, synch);
        },

        // create a throw table
        "_createTable": function(unit, count) {
            // remove 0 height
            const pattern = [];
            unit.forEach(numbers => pattern.push(numbers.filter(elem => elem != 0)));

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
        },

        // create a list of props
        "_createProps": function(table, length, synch) {
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
                prop.numbers.push(this._getNumber(synch, first, start));

                // get repeating pattern
                let position = start + first;
                while (position < row.length) {
                    const number = row[position];
                    if (number == first && (position - prop.start) % length == 0) {
                        // end when returning to the beginning of the pattern
                        break;
                    }
                    prop.times.push(number);
                    prop.numbers.push(this._getNumber(synch, number, position));
                    position += number;
                }
                prop.length = prop.times.length;
            }
            return props;
        },

        // get a number that represents the height
        "_getNumber": function(synch, number, position) {
            // check if conversion is required
            if (!synch || number % 2 == 0) {
                return number;
            }

            // convert
            if (position % 2 == 0) {
                return -(number - 1);
            } else {
                return -(number + 1);
            }
        },

    }

    // Siteswap analyzer class
    const SiteswapAnalyzer = function() {
        this._parser = new SiteswapParser();
        this._alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    }

    // Siteswap analyzer prototype
    SiteswapAnalyzer.prototype = {

        // run analysis
        "analyze": function(text) {
            // lexical analysis
            const pattern = this._getPattern(`${text}`);
            const lex = this._parser.tokenize(pattern);
            if (!lex.tokens) {
                return { "valid": false, "message": "unknown character(s): " + lex.invalid };
            }

            // syntactic analysis
            const syntax = this._parser.parse(lex.tokens);
            if (!syntax.tree) {
                return { "valid": false, "message": "syntax error: " + syntax.invalid };
            }

            // pattern analysis
            const result = this._validateTree(syntax.tree);
            if (!result.text) {
                result.text = pattern;
            }
            if (!result.valid) {
                result.message = "impossible to juggle";
                return result;
            }
            return result;
        },

        // convert to valid pattern
        "_getPattern": function(text) {
            const hankaku = text => String.fromCharCode(text.charCodeAt(0) - 0xFEE0);
            const half = text.replace(/[\uFF01-\uFF5E]/g, hankaku);
            const quote = half.replace("\u2018", "`").replace("\u2019", "'").replace(/[\u201C\u201D]/g, "\"");
            const other = quote.replace("\u3000", " ").replace("\u301C", "~").replace("\uFFE5", "\u00A5");
            return other.toLowerCase();
        },

        // validate the tree
        "_validateTree": function(tree) {
            const root = tree.children[0];

            // asynchronous siteswap
            if (root.label == "Async") {
                return this._validateAsync(root);
            }

            // synchronous siteswap
            const term = root.children.pop();
            const join = (acc, cur) => acc + cur.text;
            if (term.text == "*") {
                // mirror pattern
                const follow = [];
                for (const both of root.children) {
                    const nodes = [ both.children[0], both.children[3], both.children[2], both.children[1], both.children[4] ];
                    const text = nodes.reduce(join, "");
                    const mirror = new SiteswapTree(both.label, text);
                    Array.prototype.push.apply(mirror.children, nodes);
                    follow.push(mirror);
                }
                Array.prototype.push.apply(root.children, follow);
            } else {
                root.children.push(term);
            }

            // validate the synchronous siteswap
            const result = this._validateSynch(root);
            result.text = root.children.reduce(join, "");
            return result;
        },

        // validate the asynchronous siteswap
        "_validateAsync": function(tree) {
            // convert to array of numeric arrays
            const throws = [];
            for (const child of tree.children) {
                const props = [];
                const each = child.children[0];
                if (each.label == "AsyncMulti") {
                    // multiplex pattern
                    for (let i = 1; i < each.children.length - 1; i++) {
                        props.push(this._alphabet.indexOf(each.children[i].text));
                    }
                } else {
                    // uniplex pattern
                    props.push(this._alphabet.indexOf(each.text));
                }
                throws.push(props);
            }

            // validate the array of numeric arrays
            const result = this._validateNumbers(throws);
            result.synch = false;
            return result;
        },

        // validate the synchronous siteswap
        "_validateSynch": function(tree) {
            // convert to array of numeric arrays
            const throws = [];
            for (const both of tree.children) {
                for (let side = 0; side <= 1; side++) {
                    const props = [];
                    const one = both.children[side * 2 + 1].children[0];
                    if (one.label == "SynchMulti") {
                        // multiplex pattern
                        for (let i = 1; i < one.children.length - 1; i++) {
                            props.push(this._convertSynchBeat(one.children[i], side));
                        }
                    } else {
                        // uniplex pattern
                        props.push(this._convertSynchBeat(one, side));
                    }
                    throws.push(props);
                }
            }

            // validate the array of numeric arrays
            const result = this._validateNumbers(throws);
            result.synch = true;
            return result;
        },

        // convert a synchronous siteswap beat
        "_convertSynchBeat": function(simple, side) {
            // with x
            if (simple.children.length <= 1) {
                return this._alphabet.indexOf(simple.text);
            }

            // without x
            const index = this._alphabet.indexOf(simple.children[0].text);
            if (side == 0) {
                return index + 1;
            } else {
                return index - 1;
            }
        },

        // validate the array of numeric arrays
        "_validateNumbers": function(throws) {
            // create a drop point array
            const period = throws.length;
            const drops = new Array(period);
            for (let i = 0; i < period; i++) {
                drops[i] = 0;
            }

            // get drop points
            let sum = 0;
            let max = 0;
            for (let i = 0; i < period; i++) {
                for (const prop of throws[i]) {
                    const number = (prop + i) % period;
                    drops[number]++;
                    sum += prop;
                    if (0 < prop) {
                        max = Math.max(max, prop + i);
                    }
                }
            }

            // determine whether it is valid as a siteswap
            const result = { "valid": false, "count": 0, "period": 0, "throws": [], "state": [] };
            for (let i = 0; i < period; i++) {
                if (drops[i] != throws[i].length) {
                    return result;
                }
            }

            // set result
            result.valid = true;
            result.count = sum / period;
            result.period = period;
            result.throws = throws;
            if (max == 0) {
                result.state.push(0);
                return result;
            }

            // set state
            for (let i = 0; i < max; i++) {
                result.state.push(0);
            }
            const loop = Math.ceil(max / period)
            const width = loop * period;
            let position = 0;
            for (let i = 0; i < loop; i++) {
                for (let j = 0; j < period; j++) {
                    for (const prop of throws[j]) {
                        const number = position + prop + j;
                        if (width <= number) {
                            result.state[number - width]++;
                        }
                    }
                }
                position += period;
            }
            while (result.state[result.state.length - 1] == 0) {
                result.state.pop();
            }
            return result;
        },

    }

    // Siteswap parser class
    const SiteswapParser = function() {
        // terminal symbols
        const terms = SiteswapGrammar.terminals.concat(SiteswapGrammar.dummies);
        this._terminals = terms.map(this._quoteSingle);
        this._dummies = SiteswapGrammar.dummies.map(this._quoteSingle);

        // lexical analysis elements
        this._elements = [];
        for (const term of terms) {
            this._elements.push(new RegExp("^(" + term + ")", SiteswapGrammar.flag));
        }

        // production rules
        this._rules = [];
        const nonterms = [];
        for (let i = 0; i < SiteswapGrammar.rules.length; i++) {
            const pair = SiteswapGrammar.rules[i].split("=");
            const symbol = pair[0];
            this._rules.push({ "symbol": symbol, "count": parseInt(pair[1], 10) });
            if (0 < i && nonterms.indexOf(symbol) < 0) {
                // non-terminal symbols
                nonterms.push(symbol);
            }
        }
        nonterms.unshift("$");
        const symbols = SiteswapGrammar.terminals.map(this._quoteSingle).concat(nonterms);

        // parsing table
        this._table = [];
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
            this._table.push(row);
        }
    }

    // Siteswap parser prototype
    SiteswapParser.prototype = {

        // lexical analysis
        "tokenize": function(text) {
            const tokens = [];
            while (0 < text.length) {
                const max = new SiteswapToken();
                for (let i = 0; i < this._elements.length; i++) {
                    const result = this._elements[i].exec(text);
                    if (result && max.length < result[0].length) {
                        // get the longest and the first token
                        max.setPattern(this._terminals[i], result[0]);
                    }
                }
                if (0 < max.length) {
                    // found a token
                    if (this._dummies.indexOf(max.label) < 0) {
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
                const valid = tokens.reduce(this._joinTokens, "");
                return { "tokens": null, "valid": valid.trim(), "invalid": text };
            }
            return { "tokens": tokens };
        },

        // syntactic analysis
        "parse": function(tokens) {
            const stack = new SiteswapStack();

            // dealing all tokens
            tokens.push(new SiteswapToken("$"));
            while (0 < tokens.length) {
                const next = tokens[0];
                const label = next.label;

                // execute an action
                const action = this._table[stack.peekState()][label];
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
                    const rule = this._rules[action.number];
                    const nodes = [];
                    for (let i = 0; i < rule.count; i++) {
                        const top = stack.popTree();
                        if (top.label.charAt(0) == "#") {
                            // a non-terminal symbol that should be removed
                            Array.prototype.unshift.apply(nodes, top.children);
                        } else {
                            nodes.unshift(top);
                        }
                    }

                    // create a syntax tree
                    const node = new SiteswapTree(rule.symbol);
                    Array.prototype.push.apply(node.children, nodes);
                    if (SiteswapConverter[node.label]) {
                        SiteswapConverter[node.label](node);
                    }

                    // accept
                    if (action.number == 0) {
                        return { "tree": node.children[0] };
                    }

                    // transit
                    const goto = this._table[stack.peekState()][node.label];
                    if (!goto) {
                        break;
                    }
                    stack.push(node, goto.number);
                }
            }

            // the case of not to accept
            let valid = "";
            while (0 < stack.getCount()) {
                const tree = stack.popTree();
                valid = this._joinTree(tree) + " " + valid;
            }
            const invalid = tokens.reduce(this._joinTokens, "");
            return { "tree": null, "valid": valid.trim(), "invalid": invalid.trim() };
        },

        // add the single quatations
        "_quoteSingle": function(cur) {
            const text = cur.replace(/\\(.)/g, "$1");
            return "'" + text + "'";
        },

        // join the token strings
        "_joinTokens": function(acc, cur) {
            return acc + " " + cur.text;
        },

        // join the tree strings
        "_joinTree": function(tree) {
            if (tree.text != "") {
                return tree.text;
            }

            // join all child elements
            let text = "";
            for (const child of tree.children) {
                text += " " + this._joinTree(child);
            }
            return text;
        },

    }

    // Siteswap token class
    const SiteswapToken = function(label) {
        this.setPattern(label, "");
    }

    // Siteswap token prototype
    SiteswapToken.prototype = {

        // set the pattern
        "setPattern": function(label, text) {
            this.label = label || "";
            this.text = text || "";
            this.length = text.length;
        },

    }

    // Siteswap tree class
    const SiteswapTree = function(label, text) {
        this.label = label || "";
        this.text = text || "";
        this.children = [];
    }

    // Siteswap state stack class
    const SiteswapStack = function() {
        this._stack = [];
    }

    // Siteswap state stack prototype
    SiteswapStack.prototype = {

        // push a state pair to the stack top
        "push": function(tree, state) {
            const pair = { "tree": tree, "state": state };
            this._stack.push(pair);
        },

        // pop a state pair from the stack top, remove it, and return the tree
        "popTree": function() {
            const last = this._stack.length - 1;
            if (last < 0) {
                return null;
            } else {
                const pair = this._stack.pop();
                return pair.tree;
            }
        },

        // peek the state number of the stack top
        "peekState": function() {
            const last = this._stack.length - 1;
            if (last < 0) {
                return 0;
            } else {
                return this._stack[last].state;
            }
        },

        // get the number of the stack items
        "getCount": function() {
            return this._stack.length;
        },

    }

    // Siteswap grammar
    const SiteswapGrammar = {

        "flag": "i",

        "terminals": [
            "0",
            "x",
            "\\[",
            "\\]",
            "\\*",
            "\\(",
            ",",
            "\\)",
            "[2468acegikmoqsuwy]",
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
            "#3#=1",
            "AsyncSimple=1",
            "#4#=1",
            "#4#=1",
            "#4#=1",
            "Even=1",
            "Odd=1",
            "AsyncMulti=4",
            "#5#=2",
            "#5#=1",
            "Synch=2",
            "#6#=2",
            "#6#=1",
            "#7#=1",
            "#7#=0",
            "BothHand=5",
            "OneHand=1",
            "#8#=1",
            "#8#=1",
            "#8#=1",
            "SynchSimple=2",
            "#9#=1",
            "#9#=0",
            "SynchMulti=4",
            "#10#=2",
            "#10#=1",
        ],

        "table": [
            [ "s7", "s14", "s16", "", "", "s28", "", "", "s11", "s13", "", "g1", "g2", "g3", "g4", "g22", "g6", "g8", "g9", "g10", "g12", "g15", "", "g23", "g24", "", "g46", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "", "r0", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "", "r1", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "", "r2", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "s7", "s14", "s16", "", "", "", "", "", "s11", "s13", "r4", "", "", "", "", "g5", "g6", "g8", "g9", "g10", "g12", "g15", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r5", "r5", "r5", "", "", "", "", "", "r5", "r5", "r5", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r7", "r7", "r7", "", "", "", "", "", "r7", "r7", "r7", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r8", "r8", "r8", "", "", "", "", "", "r8", "r8", "r8", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r9", "r9", "r9", "", "", "", "", "", "r9", "r9", "r9", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r11", "r11", "r11", "r11", "", "", "", "", "r11", "r11", "r11", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r12", "r12", "r12", "r12", "", "", "", "", "r12", "r12", "r12", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r15", "r15", "r15", "r15", "", "", "r15", "r15", "r15", "r15", "r15", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r13", "r13", "r13", "r13", "", "", "", "", "r13", "r13", "r13", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r16", "r16", "r16", "r16", "", "", "", "", "r16", "r16", "r16", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r14", "r14", "r14", "r14", "", "", "", "", "r14", "r14", "r14", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r10", "r10", "r10", "", "", "", "", "", "r10", "r10", "r10", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "s14", "", "", "", "", "", "", "s11", "s13", "", "", "", "", "", "", "", "g17", "g9", "g10", "g12", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "s14", "", "", "", "", "", "", "s11", "s13", "", "", "", "", "", "", "", "g21", "g9", "g10", "g12", "", "g18", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "s14", "", "s19", "", "", "", "", "s11", "s13", "", "", "", "", "", "", "", "g20", "g9", "g10", "g12", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r17", "r17", "r17", "", "", "", "", "", "r17", "r17", "r17", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "r18", "", "r18", "", "", "", "", "r18", "r18", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "r19", "", "r19", "", "", "", "", "r19", "r19", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "r6", "r6", "r6", "", "", "", "", "", "r6", "r6", "r6", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "", "r3", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "s26", "s28", "", "", "", "", "r24", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "g25", "g27", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "", "r20", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "", "", "r23", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "r21", "r21", "", "", "", "", "r21", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "s34", "", "s40", "", "", "", "", "", "s11", "", "", "", "", "", "", "", "", "", "", "g36", "", "", "", "", "", "", "", "g29", "g33", "g35", "", "g39", "" ],
            [ "", "", "", "", "", "", "s30", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "s34", "", "s40", "", "", "", "", "", "s11", "", "", "", "", "", "", "", "", "", "", "g36", "", "", "", "", "", "", "", "g31", "g33", "g35", "", "g39", "" ],
            [ "", "", "", "", "", "", "", "s32", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "r25", "r25", "", "", "", "", "r25", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "r26", "r26", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "r27", "r27", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "r28", "r28", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "s38", "", "r32", "", "", "r32", "r32", "r32", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "g37", "", "" ],
            [ "", "", "", "r30", "", "", "r30", "r30", "r30", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "r31", "", "", "r31", "r31", "r31", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "r29", "r29", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "s11", "", "", "", "", "", "", "", "", "", "", "g36", "", "", "", "", "", "", "", "", "", "g41", "", "", "" ],
            [ "", "", "", "", "", "", "", "", "s11", "", "", "", "", "", "", "", "", "", "", "g36", "", "", "", "", "", "", "", "", "", "g45", "", "", "g42" ],
            [ "", "", "", "s43", "", "", "", "", "s11", "", "", "", "", "", "", "", "", "", "", "g36", "", "", "", "", "", "", "", "", "", "g44", "", "", "" ],
            [ "", "", "", "", "", "", "r33", "r33", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "r34", "", "", "", "", "r34", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "r35", "", "", "", "", "r35", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
            [ "", "", "", "", "r22", "r22", "", "", "", "", "r22", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" ],
        ],

    }

    // Siteswap converter
    const SiteswapConverter = {

        // Pattern ::= Async | Synch ;
        "Pattern": function(tree) {
            tree.text = tree.children[0].text;
        },

        // Async ::= EachHand+ ;
        "Async": function(tree) {
            tree.text = tree.children.reduce(this._join, "");
        },

        // EachHand ::= '0' | AsyncSimple | AsyncMulti ;
        "EachHand": function(tree) {
            tree.text = tree.children[0].text;
        },

        // AsyncSimple ::= Even | Odd | 'x' ;
        "AsyncSimple": function(tree) {
            tree.text = tree.children[0].text;
        },

        // Even ::= "[2468acegikmoqsuwy]" ;
        "Even": function(tree) {
            tree.text = tree.children[0].text;
        },

        // Odd ::= "[13579bdfhjlnprtvz]" ;
        "Odd": function(tree) {
            tree.text = tree.children[0].text;
        },

        // AsyncMulti ::= '[' AsyncSimple AsyncSimple+ ']' ;
        "AsyncMulti": function(tree) {
            tree.text = tree.children.reduce(this._join, "");
        },

        // Synch ::= BothHand+ '*'? ;
        "Synch": function(tree) {
            tree.text = tree.children.reduce(this._join, "");
        },

        // BothHand ::= '(' OneHand ',' OneHand ')' ;
        "BothHand": function(tree) {
            tree.text = tree.children.reduce(this._join, "");
        },

        // OneHand ::= '0' | SynchSimple | SynchMulti ;
        "OneHand": function(tree) {
            tree.text = tree.children[0].text;
        },

        // SynchSimple ::= Even 'x'? ;
        "SynchSimple": function(tree) {
            tree.text = tree.children.reduce(this._join, "");
        },

        // SynchMulti ::= '[' SynchSimple SynchSimple+ ']' ;
        "SynchMulti": function(tree) {
            tree.text = tree.children.reduce(this._join, "");
        },

        // join the strings
        "_join": function(acc, cur) {
            return acc + cur.text;
        },

    }

    // public classes
    parent.Facade = Facade;
    parent.Core = CorePublic;
    parent.Animator = AnimatorPublic;
    parent.BasicCreator = CreatorPublic;

    // public methods
    const analyzer = new SiteswapAnalyzer();
    const converter = new PropsConverter();
    parent.Siteswap = {};
    parent.Siteswap.analyze = analyzer.analyze.bind(analyzer);
    parent.Siteswap.separate = converter.separate.bind(converter);

})(jmotion);


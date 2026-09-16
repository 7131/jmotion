// Controller class
class Controller {
    #all;
    #tests = { "analyze": AnalyzeData, "separate": SeparateData, "basic": BasicCreatorData };
    #buttons = new Map();
    #count = 0;

    // constructor
    constructor() {
        window.addEventListener("load", this.#initialize.bind(this));
    }

    // initialize the page
    #initialize(e) {
        for (const id in this.#tests) {
            const data = this.#tests[id];

            // get title
            const section = document.getElementById(id);
            const title = section.querySelector("h2");
            if (title != null && title.textContent.trim() == "") {
                title.textContent = `${data.method}()`;
            }

            // get table
            const table = section.querySelector("table");
            if (table == null || table.tBodies.length == 0) {
                continue;
            }
            const test = new TestTable(id, table.tBodies[0]);
            test.generate(data);
            test.completeEvent = this.#setButtons.bind(this);
            test.replaceEvent = this.#replace.bind(this);

            // get button
            const button = section.querySelector("button");
            button.addEventListener("click", this.#executeTest.bind(this));
            this.#buttons.set(button, { "table": test, "method": data.method });
        }

        // run all
        this.#all = document.getElementById("all");
        this.#all.addEventListener("click", this.#executeAll.bind(this));
    }

    // execute all tests
    #executeAll(e) {
        this.#setButtons(true);
        this.#count = this.#buttons.size;
        for (const data of this.#buttons.values()) {
            data.table.start(data.method);
        }
    }

    // execute a test
    #executeTest(e) {
        this.#setButtons(true);
        this.#count = 1;
        const data = this.#buttons.get(e.currentTarget);
        data.table.start(data.method);
    }

    // set the buttons
    #setButtons(disabled) {
        if (!disabled) {
            this.#count--;
            if (0 < this.#count) {
                return;
            }
        }
        this.#buttons.keys().forEach(elem => elem.disabled = disabled);
        this.#all.disabled = disabled;
    }

    // a function that change JSON stringification behavior
    #replace(key, value) {
        if (value instanceof SVGPoint) {
            return { "x": value.x, "y": value.y };
        }
        switch (key) {
            case "x":
            case "y":
                // coordinates are rounded to the nearest integer
                return Math.round(value);
            case "z":
            case "w":
                // ignore coordinates beyond two dimensions
                break;
            default:
                return value;
        }
    }

}

// start the controller
new Controller();


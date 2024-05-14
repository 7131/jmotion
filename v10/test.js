// Column number constants
const ColNum = {
    "NUMBER": 0,
    "PARAMS": 1,
    "EXPECT": 2,
    "RESULT": 3,
}

// Controller class
const Controller = function() {
    // fields
    this._functions = new Map();
    this._buttons = new Map();
    this._rows = new Map();

    // events
    window.addEventListener("load", this._initialize.bind(this));
}

// Controller prototype
Controller.prototype = {

    // initialize the page
    "_initialize": function(e) {
        const sections = document.getElementsByTagName("section");
        // process by section
        for (const section of sections) {
            const button = section.getElementsByTagName("button")[0];
            const name = button.dataset.function;
            const func = this._getFunction(name);
            if (func) {
                // only sections with settings
                this._functions.set(name, func);
                this._buttons.set(name, button);
                button.addEventListener("click", this._executeTest.bind(this));

                // get table
                const table = section.getElementsByTagName("table")[0];
                this._rows.set(name, table.rows);
                this._setRowData(name, table.rows);
            }
        }

        // run all
        const all = document.getElementById("all");
        all.addEventListener("click", this._executeAll.bind(this));
    },

    // get the function
    "_getFunction": function(name) {
        if (!name) {
            return null;
        }

        // decomposing function names
        const words = name.split(".");
        if (words.length < 2) {
            return null;
        }

        // get class
        const cls = jmotion[words[0]];
        if (!cls) {
            return null;
        }

        // get function
        if (words.length == 2) {
            return cls[words[1]];
        } else {
            const instance = new cls();
            return instance[words[2]].bind(instance);
        }
    },

    // set row data
    "_setRowData": function(name, rows) {
        if (rows.length <= 1) {
            return;
        }
        for (let i = 1; i < rows.length; i++) {
            // row number
            const number = rows[i].cells[ColNum.NUMBER];
            number.innerHTML = i;
            number.classList.add("symbol");

            // expected value
            const expect = rows[i].cells[ColNum.EXPECT];
            if (0 < expect.childNodes.length) {
                const div = expect.getElementsByTagName("div");
                let node;
                if (div.length == 0) {
                    node = expect;
                } else {
                    node = div[0];
                }
                while (node && !(node instanceof Text)) {
                    node = node.firstChild;
                }
                if (node && node.textContent != "") {
                    this._setExpected(`${name}_${i}_view`, expect, node.textContent);
                }
            }
        }

        // the last row
        const last = rows[rows.length - 1];
        const total = last.parentNode.appendChild(last.cloneNode(true));
        total.cells[ColNum.NUMBER].innerHTML = "total";
        total.cells[ColNum.PARAMS].innerHTML = "";
        total.cells[ColNum.EXPECT].innerHTML = "";
        total.cells[ColNum.RESULT].innerHTML = "";
        this._setExpected(`${name}_total_view`, total.cells[ColNum.EXPECT], "");
    },

    // set expected value column
    "_setExpected": function(id, expect, text) {
        // remove existing elements
        while (expect.lastChild) {
            expect.removeChild(expect.lastChild);
        }
        expect.dataset.expected = text;

        // checkbox
        const input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.setAttribute("id", id);
        input.addEventListener("click", this._toggleExpected.bind(this));
        expect.appendChild(input);

        // label
        const label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = "Display";
        expect.appendChild(label);

        // string
        const div = document.createElement("div");
        div.classList.add("hidden");
        div.textContent = text;
        expect.appendChild(div);
    },

    // show or hide the expected column
    "_toggleExpected": function(e) {
        const input = e.currentTarget;
        const divs = [];
        const match = input.id.match(/^(.+)_total_view$/);
        if (match) {
            // total row
            const rows = this._rows.get(match[1]);
            for (let i = 1; i < rows.length; i++) {
                const expect = rows[i].cells[ColNum.EXPECT];
                if (expect.firstChild) {
                    expect.firstChild.checked = input.checked;
                    divs.push(expect.lastChild);
                }
            }
        } else {
            // test row
            divs.push(input.parentElement.lastChild);
        }
        if (input.checked) {
            // show
            divs.forEach(elem => elem.classList.remove("hidden"));
        } else {
            // hide
            divs.forEach(elem => elem.classList.add("hidden"));
        }
    },

    // execute all tests
    "_executeAll": function(e) {
        this._buttons.forEach(this._executeTable, this);
    },

    // execute a test
    "_executeTest": function(e) {
        this._executeTable(e.currentTarget);
    },

    // execute by table
    "_executeTable": function(button) {
        // target function
        const name = button.dataset.function;
        const func = this._functions.get(name);
        const rows = this._rows.get(name);

        // number of arguments
        const params = button.dataset.params;
        let count = 2;
        if (params && !isNaN(params)) {
            count = parseInt(params, 10);
        }
        this._buttons.forEach(elem => elem.disabled = true);

        // initialize the table
        for (let i = 1; i < rows.length; i++) {
            const result = rows[i].cells[ColNum.RESULT];
            result.innerHTML = "";
            result.classList.remove("error");
        }

        // start
        const errors = [];
        for (let i = 1; i < rows.length; i++) {
            const message = this._executeRow(func, count, rows[i]);
            const result = rows[i].cells[ColNum.RESULT];
            if (message == "") {
                result.innerHTML = "OK";
            } else {
                result.innerHTML = message;
                result.classList.add("error");
                errors.push(i);
            }
        }

        // finished
        const last = rows[rows.length - 1].cells[ColNum.RESULT];
        if (errors.length == 0) {
            last.innerHTML = "All OK";
        } else {
            last.innerHTML = "NG : " + errors.join();
            last.classList.add("error");
        }
        this._buttons.forEach(elem => elem.disabled = false);
    },

    // execute by row
    "_executeRow": function(func, count, row) {
        // get arguments and expected value
        const params = row.cells[ColNum.PARAMS].innerText;
        const expect = row.cells[ColNum.EXPECT].dataset.expected;
        if (params == "" && !expect) {
            return "";
        }

        // execute
        let actual;
        switch (count) {
            case 0:
                actual = func();
                break;
            case 1:
                actual = func(params);
                break;
            default:
                let data = params;
                try {
                    data = JSON.parse(params);
                } catch {
                    // if not JSON, treat as a single string
                }
                if (Array.isArray(data)) {
                    actual = func(...data);
                } else {
                    actual = func(data);
                }
                break;
        }
        const result = JSON.stringify(actual, this._replace.bind(this));
        if (result == expect) {
            return "";
        } else {
            return result;
        }
    },

    // a function that change JSON stringification behavior
    "_replace": function(key, value) {
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
    },

}

// start the controller
new Controller();


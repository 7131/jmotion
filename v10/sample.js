// Controller class
const Controller = function() {
    window.addEventListener("load", this._initialize.bind(this), false);
}

// Controller prototype
Controller.prototype = {

    // initialize the private fields
    "_initialize": function(e) {
        // DOM elements
        this._facade = new jmotion.Facade(document.getElementById("board"));
        this._pattern = document.getElementById("pattern");
        this._message = document.getElementById("message");
        this._startButton = document.getElementById("start");
        this._stopButton = document.getElementById("stop");
        this._prevButton = document.getElementById("prev");
        this._nextButton = document.getElementById("next");
        this._restartButton = document.getElementById("restart");

        // control settings
        this._setButtons();

        // button events
        this._startButton.addEventListener("click", this._start.bind(this), false);
        this._stopButton.addEventListener("click", this._stop.bind(this), false);
        this._prevButton.addEventListener("click", this._prev.bind(this), false);
        this._nextButton.addEventListener("click", this._next.bind(this), false);
        this._restartButton.addEventListener("click", this._restart.bind(this), false);
    },

    // "Start" button process
    "_start": function(e) {
        // parse the input text
        this._message.innerHTML = "";
        const message = this._facade.startJuggling(this._pattern.value);
        if (message != "") {
            this._message.innerHTML = message;
            return;
        }

        // control settings
        this._setButtons();
    },

    // "Stop" button process
    "_stop": function(e) {
        this._facade.stopJuggling();
        this._setButtons();
    },

    // "Prev" button process
    "_prev": function(e) {
        const current = this._facade.animator.getIndex();
        this._facade.animator.setIndex(current - 1);
    },

    // "Next" button process
    "_next": function(e) {
        const current = this._facade.animator.getIndex();
        this._facade.animator.setIndex(current + 1);
    },

    // "Restart" button process
    "_restart": function(e) {
        this._facade.startJuggling();
        this._setButtons();
    },

    // set the buttons
    "_setButtons": function() {
        const status = this._facade.animator.getStatus();
        const running = status.running;
        const runnable = running || !status.runnable;
        this._startButton.disabled = running;
        this._stopButton.disabled = !running;
        this._restartButton.disabled = runnable;
        this._prevButton.disabled = runnable;
        this._nextButton.disabled = runnable;
    },

}

// start the controller
new Controller();


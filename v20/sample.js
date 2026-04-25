// Controller class
class Controller {
    #facade;
    #pattern;
    #message;
    #resolution;
    #startButton;
    #stopButton;
    #speedRange;

    // constructor
    constructor() {
        window.addEventListener("load", this.#initialize.bind(this));
    }

    // initialize the private fields
    #initialize(e) {
        this.#facade = new jmotion.Facade("#board");
        this.#pattern = document.getElementById("pattern");
        this.#message = document.getElementById("message");
        this.#resolution = document.getElementById("resolution");
        this.#startButton = document.getElementById("start");
        this.#stopButton = document.getElementById("stop");
        this.#speedRange = document.getElementById("speed");

        // control settings
        this.#setElements();

        // button events
        this.#startButton.addEventListener("click", this.#start.bind(this));
        this.#stopButton.addEventListener("click", this.#stop.bind(this));
        this.#speedRange.addEventListener("input", this.#speed.bind(this));
    }

    // "Start" button process
    #start(e) {
        this.#message.textContent = "";
        this.#speedRange.value = 1;
        this.#facade.generator.resolution = this.#resolution.value;
        const message = this.#facade.startJuggling(this.#pattern.value);
        if (message != "") {
            this.#message.textContent = message;
            return;
        }
        this.#setElements();
    }

    // "Stop" button process
    #stop(e) {
        this.#facade.stopJuggling();
        this.#setElements();
    }

    // change speed
    #speed(e) {
        const speed = parseFloat(this.#speedRange.value);
        if (isNaN(speed)) {
            return;
        }
        this.#facade.animator.speed = speed;
    }

    // set the elements
    #setElements() {
        const running = this.#facade.animator.status.running;
        this.#pattern.disabled = running;
        this.#resolution.disabled = running;
        this.#startButton.disabled = running;
        this.#stopButton.disabled = !running;
        this.#speedRange.disabled = !running;
    }

}

// start the controller
new Controller();


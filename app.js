(function (w) {
    var canvas,
        gl,
        audio,
        audio_ctx,
        audioSrc,
        gainNode,
        audio_buffer,
        startedAt,
        pausedAt,
        analyser,
        frequencyData,
        canvas_width,
        canvas_height,
        vShader,
        fShader,
        ratio,
        vertexBuffer,
        colorBuffer,
        vertices,
        modulated,
        velocities,
        freqArr,
        colorArr,
        thetaArr,
        velThetaArr,
        velRadArr,
        boldRateArr,
        playing = false,
        fieldOfView = 30.0,
        nearPlane = 1.0,
        farPlane = 10000.0,
        aspectRatio,
        top,
        bottom,
        right,
        left,
        uModelViewMatrix,
        perspectiveMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    var settings = {
        numLines: 30000,
        color: { r: 255, g: 255, b: 255 },
        removeRed: 0.01,
        removeGreen: 0.02,
        removeBlue: 0.03,
        trebReact: 4,
        midReact: 3.0,
        bassReact: 2.0,
        invert: false,
        volume: 1,
    };

    var target = [],
        randomTargetXArr = [],
        randomTargetYArr = [];

    var count = 0;
    var cn = 0;

    var audio_available = false;

    function init() {
        canvas = document.getElementById("c");
        gl = canvas.getContext("experimental-webgl");

        if (!gl) {
            alert("There's no WebGL context available.");
            return;
        }

        vShader = load_shader("shader-vs", gl.VERTEX_SHADER);

        if (!vShader) {
            alert("Couldn't compile the vertex shader.");
            return;
        }

        fShader = load_shader("shader-fs", gl.FRAGMENT_SHADER,);
        

        if (!fShader) {
            alert("Couldn't compile the fragment shader.");
            return;
        }

        gl.program = gl.createProgram();
        gl.attachShader(gl.program, vShader);
        gl.attachShader(gl.program, fShader);
        gl.linkProgram(gl.program);

        if (!gl.getProgramParameter(gl.program, gl.LINK_STATUS)) {
            gl.deleteProgram(gl.program);
            gl.deleteProgram(vShader);
            gl.deleteProgram(fShader);
            alert("Unable to initialise shaders");
            return;
        }

        gl.useProgram(gl.program);

        var vertexPosition = gl.getAttribLocation(gl.program, "vertexPosition");
        var colorAttrib = gl.getAttribLocation(gl.program, "a_color");

        var uPerspectiveMatrix = gl.getUniformLocation(
            gl.program,
            "perspectiveMatrix"
        );
        uModelViewMatrix = gl.getUniformLocation(gl.program, "modelViewMatrix");

        vertexBuffer = gl.createBuffer();
        colorBuffer = gl.createBuffer();

        setup_vertices();

        gl.uniformMatrix4fv(
            uPerspectiveMatrix,
            false,
            new Float32Array(perspectiveMatrix)
        );

        gl.enableVertexAttribArray(vertexPosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(vertexPosition, 3.0, gl.FLOAT, false, 0, 0); //28, 0
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

        gl.enableVertexAttribArray(colorAttrib);
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.vertexAttribPointer(colorAttrib, 4.0, gl.FLOAT, false, 0, 0);
        gl.bufferData(gl.ARRAY_BUFFER, colorArr, gl.DYNAMIC_DRAW);

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);

        gl.enable(gl.BLEND);
        gl.disable(gl.DEPTH_TEST);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        handle_resize();

        var resize = debounce(handle_resize, 20);

        w.addEventListener("resize", resize);
        canvas.addEventListener("click", toggle);

        try {
            if (typeof AudioContext != "undefined") {
                audio_ctx = new AudioContext();
            } else if (typeof webkitAudioContext != "undefined") {
                audio_ctx = new webkitAudioContext();
            } else if (typeof mozAudioContext != "undefined") {
                audio_ctx = new mozAudioContext();
            }

            //audio = document.getElementById("music");

            var xmlHTTP = new XMLHttpRequest();

            //music song sourse

            song = "/tcob.mp3";

            xmlHTTP.open("GET", song, true);

            xmlHTTP.responseType = "arraybuffer";

            xmlHTTP.onload = function (e) {
                analyser = audio_ctx.createAnalyser();
                //audioSrc = audio_ctx.createMediaElementSource(audio);

                audio_ctx.decodeAudioData(this.response, function (buffer) {
                    audioSrc = audio_ctx.createBufferSource();
                    gainNode = audio_ctx.createGain();
                    //gainNode.gain.value = 1;
                    audioSrc.buffer = buffer;
                    audio_buffer = buffer;

                    audioSrc.connect(gainNode);
                    gainNode.connect(analyser);
                    analyser.connect(audio_ctx.destination);
                    analyser.fftSize = 64;

                    frequencyData = new Uint8Array(analyser.frequencyBinCount);

                    audio_available = true;
                    if (playing) {
                        startedAt = pausedAt ? Date.now() - pausedAt : Date.now();
                        audioSrc.start();
                    }
                });
            };

            xmlHTTP.send();
        } catch (e) {
            console.log("Couldn't load audio.");
        }

        w.onload = setTimeout(play(),3000);
    }

    function play() {
        playing = true;
        if (audio_available) {
            startedAt = pausedAt ? Date.now() - pausedAt : Date.now();
            audioSrc = audio_ctx.createBufferSource();
            audioSrc.buffer = audio_buffer;
            audioSrc.connect(gainNode);
            pausedAt ? audioSrc.start(0, pausedAt / 1000) : audioSrc.start();
        }

        animate();
    }

    function pause() {
        playing = false;
        if (audio_available) {
            pausedAt = Date.now() - startedAt;
            //console.log(frequencyData);
            //console.log(settings.color);
            //console.log("Vertices: " + (vertices.length / 3));
            //console.log(vertices[119997] + ", " + vertices[119998] + ", " + vertices[119999]);
            audioSrc.stop();
        }
    }

    function toggle() {
        playing ? pause() : play();
    }
    

    function handle_resize() {
        canvas_width = window.innerWidth;
        canvas_height = window.innerHeight;
        canvas.width = canvas_width;
        canvas.height = canvas_height;
        gl.viewport(0, 0, canvas.width, canvas.height);

        aspectRatio = canvas.width / canvas.height;
        (top = nearPlane * Math.tan((fieldOfView * Math.PI) / 360.0)),
            (bottom = -top),
            (right = top * aspectRatio),
            (left = -right);

        var a = (right + left) / (right - left);
        var b = (top + bottom) / (top - bottom);
        var c = (farPlane + nearPlane) / (farPlane - nearPlane);
        var d = (1 * farPlane * nearPlane) / (farPlane - nearPlane);
        var x = (1 * nearPlane) / (right - left);
        var y = (1 * nearPlane) / (top - bottom);

        modelViewMatrix = [x, 0, a, 0, 0, y, b, 0, 0, 0, c, d, 0, 0, -1, 0];

        gl.uniformMatrix4fv(
            uModelViewMatrix,
            false,
            new Float32Array(modelViewMatrix)
        );
    }

    w.Flurry = {
        initialize: init,
        pause: pause,
        play: play,
        toggle: toggle,
        settings: settings,
    };

    function load_shader(el, type) {
        var shaderScript = document.getElementById(el);
        var shader = gl.createShader(type);

        gl.shaderSource(shader, shaderScript.text);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return false;
        }

        return shader;
    }

    function setup_vertices() {
        vertices = [];
        velThetaArr = [];
        velRadArr = [];
        velocities = [];
        thetaArr = [];
        freqArr = [];
        boldRateArr = [];
        colorArr = [];

        for (var ii = 0; ii < settings.numLines; ii++) {
            var rad = 0.3; //( 0.1 + .2 * Math.random() );
            var theta = Math.random() * Math.PI * 2;
            var velTheta = (Math.random() * Math.PI * 2) / 30;
            var freq = Math.random() * 0.12 + 0.03;
            var boldRate = Math.random() * 0.04 + 0.01;
            //var randomPosX = (Math.random() * 2  - 1) * aspectRatio;
            //var randomPosY = Math.random() * 2 - 1;
            randomPosX = 0;
            randomPosY = 0;

            vertices.push(rad * Math.cos(theta), rad * Math.sin(theta), 1.83); // X, Y, Z
            colorArr.push(
                settings.color.r / 256,
                settings.color.g / 256,
                settings.color.b / 256,
                1
            ); // R, G, B, A

            vertices.push(rad * Math.cos(theta), rad * Math.sin(theta), 1.83); // X, Y, Z
            colorArr.push(
                settings.color.r / 256,
                settings.color.g / 256,
                settings.color.b / 256,
                1
            ); // R, G, B, A

            thetaArr.push(theta);
            velThetaArr.push(velTheta);
            velRadArr.push(rad);
            freqArr.push(freq);
            boldRateArr.push(boldRate);

            randomTargetXArr.push(randomPosX);
            randomTargetYArr.push(randomPosY);
        }

        freqArr = new Float32Array(freqArr);
        vertices = new Float32Array(vertices);
        modulated = new Float32Array(vertices);
        velocities = new Float32Array(velocities);
        colorArr = new Float32Array(colorArr);

        thetaArr = new Float32Array(thetaArr);
        velThetaArr = new Float32Array(velThetaArr);
        velRadArr = new Float32Array(velRadArr);
    }

    function animate() {
        if (!playing) return;
        requestAnimationFrame(animate);
        try {
            if (audio_available) {
                gainNode.gain.value = settings.volume;
                analyser.getByteFrequencyData(frequencyData);
            }
        } catch (e) {
            audio_available = false;
        }
        drawScene();
    }

    function drawScene() {
        var i, p, bp, cp;
        var px, py;
        var pTheta;
        var rad;
        var num;
        var rand;
        var targetX, targetY, X2, Y2;

        for (i = 0; i < settings.numLines * 2; i += 2) {
            var range, val, freq_data;

            if (audio_available) {
                range = Math.floor(
                    analyser.frequencyBinCount * (i / (settings.numLines * 2))
                );

                if (i / (settings.numLines * 2) < 1 / 3) {
                    val = settings.bassReact;
                } else if (i / (settings.numLines * 2) > 3 / 5) {
                    val = settings.trebReact;
                } else {
                    val = settings.midReact;
                }

                freq_data = (frequencyData[range] * val) / 256;
            } else {
                freq_data = 0.8;
            }

            bp = i * 3;
            cp = i * 4;

            vertices[bp] = vertices[bp + 3];
            vertices[bp + 1] = vertices[bp + 4];

            num = parseInt(i / 2);
            pTheta = thetaArr[num];
            rad = velRadArr[num] * freq_data * 5;

            pTheta = pTheta + velThetaArr[num];
            thetaArr[num] = pTheta;

            targetX = rad * Math.cos(pTheta);
            targetY = rad * Math.sin(pTheta);

            px = vertices[bp + 3];
            rand = Math.random() * 0.1 + 0.1;
            px += (targetX - px) * rand;
            vertices[bp + 3] = px;

            py = vertices[bp + 4];
            rand = Math.random() * 0.02 + 0.02;
            py +=
                (targetY - py) * rand +
                freq_data * 0.01 * (Math.random() > 0.5 ? 1 : -1);
            vertices[bp + 4] = py;

            if (audio_available) {
                var value = frequencyData[range] / 256;
                value = settings.invert ? value : 1 - value;

                let rgb;

                if (i / (settings.numLines * 2) < 1 / 3) {
                    rgb = { r: 0, g: 0, b: 255 }; //bass
                } else if (i / (settings.numLines * 2) > 3 / 5) {
                    rgb = { r: 255, g: 255, b: 255 }; //treb
                } else {
                    rgb = { r: 255, g: 255, b: 0 }; //mid
                }

                var col = [
                    Math.min(value * (rgb.r / 256)),
                    Math.min(value * (rgb.g / 256)),
                    Math.min(value * (rgb.b / 256)),
                ];

                colorArr[cp] = col[0];
                colorArr[cp + 1] = col[1];
                colorArr[cp + 2] = col[2];
                colorArr[cp + 3] = 1;

                colorArr[cp + 4] = col[0];
                colorArr[cp + 5] = col[1];
                colorArr[cp + 6] = col[2];
                colorArr[cp + 7] = 1;
            }
        }

        gl.lineWidth(1.5);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

        if (audio_available) {
            gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, colorArr, gl.DYNAMIC_DRAW);
        }

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.drawArrays(gl.LINES, 0, settings.numLines * 2); //Wasn't drawing everything...

        gl.flush();
    }

    function debounce(func, wait, immediate) {
        var timeout;

        return function () {
            var context = this,
                args = arguments;

            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };

            var callNow = immediate && !timeout;
            clearTimeout(timeout);

            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
})(window);

Flurry.initialize();
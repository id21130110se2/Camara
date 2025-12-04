//app principal
let stream = null; // Mediastream actual de la camara
let currentFacing = 'environment'; // User = frontal y environment = trasera
let mediaRecorder = null; // Instancia de MediaRecorder para audio 
let chunks = []; // Buffers para audio grabado
let beforeInstallEvent = null; // Evento diferido para mostrar el botón de instalacion

// Accesos rápidos al DOM
const $ = (sel) => document.querySelector(sel);
const video = $('#video');
const canvas = $('#canvas');
const photos = $('#photos');
const audios = $('#audios');
const btnStartCam = $('#btnStartCam');
const btnStopCam = $('#btnStopCam');
const btnFlip = $('#btnFlip');
const btnTorch = $('#btnTorch');
const btnShot = $('#btnShot');
const videoDevices = $('#videoDevices');
const btnStartRec = $('#btnStartRec');
const btnStopRec = $('#btnStopRec');
const recStatus = $('#recStatus');
const btnInstall = $('#btnInstall');

// Instalación de PWA (A2HS)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    beforeInstallEvent = e;
    btnInstall.hidden = false;
});

btnInstall.addEventListener('click', async () => {
    if (!beforeInstallEvent) return;
    beforeInstallEvent.prompt();
    await beforeInstallEvent.userChoice;
    beforeInstallEvent = null;
    btnInstall.hidden = true;
});

// Listar cámaras disponibles
async function listVideoDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices.innerHTML = '';

    const cams = devices.filter(d => d.kind === 'videoinput');
    cams.forEach((cam) => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Cámara ${videoDevices.length + 1}`;
        videoDevices.appendChild(opt);
    });
}

// Iniciar cámara
async function startCam(constraints = {}) {
    try {
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacing, ...constraints },
            audio: false
        });

        video.srcObject = stream;

        btnStartCam.disabled = true;
        btnStopCam.disabled = false;
        btnFlip.disabled = false;
        btnTorch.disabled = false;
        btnShot.disabled = false;

        await listVideoDevices();
    } catch (err) {
        alert('No se pudo iniciar la cámara: ' + err.message);
    }
}

// Detener cámara
function stopCam() {
    if (!stream) return;

    stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;

    btnStartCam.disabled = false;
    btnStopCam.disabled = true;
    btnFlip.disabled = true;
    btnTorch.disabled = true;
    btnShot.disabled = true;
}

// Botones de cámara
btnStartCam.addEventListener('click', () => startCam());
btnStopCam.addEventListener('click', stopCam);

// Cambiar cámara frontal/trasera
btnFlip.addEventListener('click', async () => {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
    await startCam();
});

// Encender/apagar linterna (torch)
btnTorch.addEventListener('click', async () => {
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    const cts = track.getConstraints();

    try {
        const torch = !(cts.advanced && cts.advanced[0]?.torch);

        await track.applyConstraints({ advanced: [{ torch }] });
    } catch (err) {
        alert('La linterna no es compatible con este dispositivo / navegador');
    }
});

// Tomar foto
btnShot.addEventListener('click', () => {
    if (!stream) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `foto-${Date.now()}.png`;
        a.textContent = 'Descargar Foto';
        a.className = 'btn';

        const img = document.createElement('img');
        img.src = url;
        img.alt = 'captura';
        img.style.width = '100%';

        const wrap = document.createElement('div');
        wrap.appendChild(img);
        wrap.appendChild(a);

        photos.prepend(wrap);
    }, 'image/png');
});

// ======================
// Grabación de Audio
// ======================
function supportsRecorder() {
    return 'MediaRecorder' in window;
}

let audioStream = null; // stream global de audio

// Iniciar grabación
btnStartRec.addEventListener('click', async () => {
    if (!supportsRecorder()) {
        alert('MediaRecorder no está disponible en este navegador.');
        return;
    }

    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        chunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstart = () => {
            recStatus.textContent = 'Grabando...';
        };

        mediaRecorder.onstop = () => {
            recStatus.textContent = 'Grabación detenida';

            const blob = new Blob(chunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);

            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = url;

            const link = document.createElement('a');
            link.href = url;
            link.download = `audio-${Date.now()}.webm`;
            link.textContent = 'Descargar audio';
            link.className = 'btn';

            const wrap = document.createElement('div');
            wrap.appendChild(audio);
            wrap.appendChild(link);

            if (audios) {
                audios.prepend(wrap);
            }

            if (audioStream) {
                audioStream.getTracks().forEach(t => t.stop());
                audioStream = null;
            }

            btnStartRec.disabled = false;
            btnStopRec.disabled = true;
        };

        mediaRecorder.start();

        btnStartRec.disabled = true;
        btnStopRec.disabled = false;

    } catch (err) {
        alert('No se pudo iniciar el micrófono: ' + err.message);
    }
});

// Evento click para detener la grabación
btnStopRec.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
});

//Cuando la pestaña o app pierde focus (foco de atencion) apagamos la camara para ahorrar recursos.
window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopCam();
    }
});

// Service worker registrado
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

//Vibracion con toggle
let vibrando = false;  // Estado de la vibracion simulada
let vibrarInterval = null; //Intervalo que repite el patron de vibracion
const btnVibrar = document.getElementById("btnVibrar");

if (btnVibrar) {
    btnVibrar.addEventListener("click", () => {
        // Verifica el soporte de la API de vibracion
        if (!("vibrate" in navigator)) {
            alert("Tu dispositivo o navegador no soporta la vibracion.");
            return;
        }

        if (!vibrando) {
            //Inicia vibracion repetida (300ms vibra y 100ms pausa)
            vibrando = true;
            btnVibrar.textContent = "Detener vibracion.";
            vibrarInterval = setInterval(() => {
                navigator.vibrate([300, 100]); //Patron corto
            }, 400);
        } else {
            //Detiene vibracion y limpia intervalo
            vibrando = false;
            btnVibrar.textContent = "Vibrar";
            clearInterval(vibrarInterval);
            navigator.vibrate(0); // Apagar la vibracion inmediatamente
        }
    });
}

//Tono de llamada simulado
let sonando = false; //Estado de la reproduccion
let ringtoneAudio = new Audio("assets/old_phone_ring.mp3"); //Ruta del audio
ringtoneAudio.loop = true; //Reproducir un bucle para simular el audio

const btnRingtone = document.getElementById("btnRingtone");

if (btnRingtone) {
    btnRingtone.addEventListener("click", () => {
        if (!sonando) {
            //Inicia reproduccion del tono y actualiza el texto del boton
            ringtoneAudio.play()
                .then(() => {
                    sonando = true;
                    btnRingtone.textContent = "Detener tono.";
                })
                .catch(err => alert("No se pudo reproducir el tono. " + err.message));
        } else {
            //Pausa y reinicia el audio, restableciendo el boton
            ringtoneAudio.pause();
            ringtoneAudio.currentTime = 0; //Vuelve a reiniciar el audio desde el inicio
            sonando = false;
            btnRingtone.textContent = "Reproducir tono.";
        }
    });
}

const peer_config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
    ]
};

let join_btn = document.querySelector('.join-btn');
let host_btn = document.querySelector('.host-btn');
let offer_key = document.querySelector('#offer_key');
let answer_key = document.querySelector('#answer_key');
let join_key = document.querySelector('#joinee-key');
const video_elem = document.querySelector('video');
const join_type = window.location.pathname.split('/')[1];

let local_connection;
let localMediaStream;

//websocket gateway to execute peer events on OS.
const gateway = new WebSocket('ws://127.0.0.1:10043');
gateway.onclose = handle_gateway_close;
gateway.onopen = handle_gateway_open;
gateway.onmessage = handle_gateway_message;
gateway.onerror = handle_gateway_error;

// Generate an object version of the event.
var event_to_object = function (e) {
    if (e) {
        let o = {
            altKey: e.altKey,
            bubbles: e.bubbles,
            button: e.button,
            buttons: e.buttons,
            cancelBubble: e.cancelBubble,
            cancelable: e.cancelable,
            clientX: e.clientX,
            clientY: e.clientY,
            composed: e.composed,
            ctrlKey: e.ctrlKey,
            defaultPrevented: e.defaultPrevented,
            detail: e.detail,
            eventPhase: e.eventPhase,
            isTrusted: e.isTrusted,
            layerX: e.layerX,
            layerY: e.layerY,
            metaKey: e.metaKey,
            movementX: e.movementX,
            movementY: e.movementY,
            offsetX: e.offsetX,
            offsetY: e.offsetY,
            pageX: e.pageX,
            pageY: e.pageY,
            returnValue: e.returnValue,
            screenX: e.screenX,
            screenY: e.screenY,
            shiftKey: e.shiftKey,
            timeStamp: e.timeStamp,
            type: e.type,
            which: e.which,
            x: e.x,
            y: e.y
        };

        return o;
    }
};

function utf8ToBase64(str) {
    const utf8Bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode(...utf8Bytes));
};

function base64ToUtf8(base64Str) {
    const binaryStr = atob(base64Str);
    const utf8Bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        utf8Bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder().decode(utf8Bytes);
};

const toast = (text, type) => {
    Toastify({
        text: text,
        duration: 3000,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "right", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
            background: type === 'error' ? 'linear-gradient(to right, rgb(255, 95, 109), rgb(255, 195, 113));' : 'linear-gradient(to right, rgb(0, 176, 155), rgb(150, 201, 61))'
        }
    }).showToast();
};

const stringify_event = (e) => {
    const obj = {};
    for (let k in e) {
        obj[k] = e[k];
    }
    return JSON.stringify(obj, (k, v) => {
        if (v instanceof Node) return 'Node';
        if (v instanceof Window) return 'Window';
        return v;
    }, ' ');
};

const req = {
    get: async (url, body) => {
        try {
            const resp = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'GET',
                body: JSON.stringify(body)
            });

            const json_resp = await resp.json();

            return { status: resp.status, data: json_resp };

        } catch (error) {
            const err_msg = '[ERROR]: something went wrong with the GET request!';
            toast(err_msg, 'error');
            console.log(err_messsage, error);
        };
    },

    post: async (url, body) => {
        try {
            const resp = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json'
                },
                method: 'POST',
                body: JSON.stringify(body)
            });

            const json_resp = await resp.json();

            return { status: resp.status, data: json_resp };

        } catch (error) {
            const err_msg = '[ERROR]: something went wrong with the POST request!';
            toast(err_msg, 'error');
            console.log(err, error);
        };
    }
};

const create_local_connection = async () => {
    local_connection = new RTCPeerConnection(peer_config);
    local_connection.onicecandidate = (e) => {
        handle_on_ice_candidate(local_connection.localDescription);
    };

    local_connection.oniceconnectionstatechange = (state) => {
        if (state === 'connected') {
            alert('Press F11 to fullscreen, otherwise there will be problems!');
        };
    };

    local_connection.addEventListener('track', async (event) => {
        const [remoteStream] = event.streams;
        video_elem.srcObject = remoteStream;
    });

    if (join_type === 'host') {
        await set_media_tracks({
            video: { frameRate: 60, displaySurface: 'monitor' },
            audio: false,
        });
        handle_data_channel();
    } else {
        local_connection.ondatachannel = handle_data_channel;
    };

    local_connection.onconnectionstatechange = handle_connection_state_change;

    if (join_type === 'host') {
        create_offer();
    };
};

async function handle_on_ice_candidate(candidate) {
    if (join_type === 'host') {
        offer_key.value = utf8ToBase64(JSON.stringify(candidate));
    } else if (join_type === 'join') {
        join_key.value = utf8ToBase64(JSON.stringify(candidate));
    };
};

function handle_remote_description(remoteDescription) {
    local_connection.setRemoteDescription(remoteDescription).then(a => {
        if (join_type === 'join') {
            create_answer();
        };
    });
};

async function create_offer() {
    try {
        const offer = await local_connection.createOffer();
        await local_connection.setLocalDescription(offer);
    } catch (error) {
        const err_msg = '[ERROR]: cannot create offer!';
        toast(err_msg, 'error');
        console.error(err_msg, error);
    };
};

async function create_answer() {
    try {
        const answer = await local_connection.createAnswer();
        await local_connection.setLocalDescription(answer);
    } catch (error) {
        const err_msg = '[ERROR]: cannot create answer!';
        toast(err_msg, 'error');
        console.error(err_msg, error);
    };
};

function handle_data_channel(e) {
    let data_channel;
    //todo: if an error occurs from the gateway about the events, then send it to the joinee. 
    if (e) {
        data_channel = e.channel;
    } else {
        data_channel = local_connection.createDataChannel("data_channel");
    };
    data_channel.onmessage = e => {
        gateway.send(e.data);
    };
    data_channel.onopen = event => {
        console.log('[DATA-CHANNEL]: Connection established with peer!');
        if (e) {
            const events_tool = events();
            video_elem.addEventListener('mousemove', events_tool.handle_mouse_event);
            video_elem.addEventListener('mouseup', events_tool.handle_mouse_event);
            video_elem.addEventListener('mousedown', events_tool.handle_mouse_event);
            document.addEventListener('contextmenu', function (event) {
                event.preventDefault();
                events_tool.handle_mouse_event(event);
            });
            document.addEventListener('keydown', events_tool.handle_key_event);
            document.addEventListener('keyup', events_tool.handle_key_event);
        };
    };
    data_channel.onclose = e => {
        console.log('[DATA-CHANNEL]: Connection closed with peer!');
    };

    local_connection.data_channel = data_channel;
};

async function set_media_tracks(displayMediaOptions) {
    try {
        localMediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        local_connection.addStream(localMediaStream);
    } catch (err) {
        console.error(`Error: ${err}`);
    }
};

async function handle_connection_state_change(ev) {
    console.log('state changed', ev.currentTarget.connectionState);
    if (ev.currentTarget.connectionState === 'connected') {
        if (join_type === 'host') {
            document.querySelector('.container').innerHTML = 'STREAMING TO THE PEER !!!';
        } else if (join_type === 'join') {
            document.querySelector('.container').classList.add('display-none');
            video_elem.style.display = 'block';
            video_elem.classList.add('full-screen');
        };
    };
};

document.addEventListener('DOMContentLoaded', async () => {
    if (join_type === 'host') {
        create_local_connection();
        host_btn.addEventListener('click', async (event) => {
            handle_remote_description(JSON.parse(base64ToUtf8(answer_key.value)));
        });

    } else if (join_type === 'join') {
        join_btn.addEventListener('click', async (event) => {
            create_local_connection();
            handle_remote_description(JSON.parse(base64ToUtf8(join_key.value)));
        });
    };
});

function handle_gateway_open() {
    console.log('[GATEWAY]: Connection established with server!');
};

function handle_gateway_close() {
    console.log('[GATEWAY]: Connection closed with server!');
};

function handle_gateway_message(event) {
    try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
            case 'error':
                console.error('[GATEWAY]: error with message:', msg.error);
                break;
            default:
                break;
        }
    }
    catch (error) {
        console.error('[GATEWAY]: Not a json message:', event.data);
    };
};

function handle_gateway_error(event) {
    const err_msg = '[GATEWAY]: Error with gateway';
    console.error('[GATEWAY]: Error with gateway', event);
    toast(err_msg);
};

//logic for mouse and keyboard events.
const events = function () {
    function handle_mouse_event(e) {
        e = event_to_object(e);
        let x = e.clientX - this.offsetLeft;
        let y = e.clientY - this.offsetTop;
        const positions = { X: x, Y: y };
        e.dimensions = { width: video_elem.offsetWidth, height: video_elem.offsetHeight };
        e.positions = positions;
        let message = { type: 'mouse', event: e };

        //a little delay to prevent bombing
        const timeout = setTimeout(() => {
            local_connection.data_channel.send(JSON.stringify(message));
            clearTimeout(timeout);
        }, 100);
    };

    function handle_key_event(e) {
        e.preventDefault()
        e = event_to_object(e);
        const message = { type: 'keyboard', event: e };

        //a little delay to prevent bombing
        const timeout = setTimeout(() => {
            local_connection.data_channel.send(JSON.stringify(message));
            clearTimeout(timeout);
        }, 100);
    };

    return {
        handle_mouse_event, handle_key_event
    };
};
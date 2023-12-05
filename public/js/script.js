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
        console.log('got an ice candidate')
        handle_on_ice_candidate(local_connection.localDescription);
    };

    local_connection.oniceconnectionstatechange = (state) => {
        console.log('ice connection state', state);
    };

    local_connection.addEventListener('track', async (event) => {
        const [remoteStream] = event.streams;
        console.log('got Stream')
        video_elem.srcObject = remoteStream;
    });

    if (join_type === 'host') {
        await set_media_tracks({
            video: true,
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
        offer_key.value = JSON.stringify(candidate);
        // let resp = await req.post('/api/encrypt/offer', { offer: JSON.stringify(candidate) });
        // if (resp.status === 200) {
        //     offer_key.value = resp.data.encrypted;
        //     document.querySelector('.host-command-text').textContent = 'Copy this offer key and share it with the peer who wants to join';
        //     toast('Copy the offer key and share it with the peer!');
        // }

    } else if (join_type === 'join') {
        join_key.value = JSON.stringify(candidate)
        // let resp = await req.post('/api/encrypt/answer', { answer: JSON.stringify(candidate) });
        // if (resp.status === 200) {
        //     // join_key.value = resp.data.encrypted
        //     document.querySelector('.joinee-command-text').textContent = 'Copy this answer key and share it with the host';
        //     toast('Copy the answer key and share it with the host!');
        // };
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
        console.log('got a message');
        gateway.send(e.data);
    };
    data_channel.onopen = e => {
        console.log('[DATA-CHANNEL]: Connection established with peer!');
        if (e) {
            const events_tool = events();
            video_elem.addEventListener('mousemove', events_tool.handle_mouse_event);
            video_elem.addEventListener('click', events_tool.handle_mouse_event);
            document.addEventListener('contextmenu', function (event) {
                event.preventDefault();
                events_tool.handle_mouse_event(e);
            });
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
            handle_remote_description(JSON.parse(answer_key.value));
            // const resp = await req.post('/api/decrypt/answer', { answer: answer_key.value });
            // if (resp.status === 200) {
            //     answer_key.value = resp.data.decrypted;
            //     handle_remote_description(JSON.parse(resp.data.decrypted));
            // };
        });

        // answer_key.addEventListener("input", function () {
        //     host_btn.disabled = answer_key.value.trim() === "";
        // });
    } else if (join_type === 'join') {
        join_btn.addEventListener('click', async (event) => {
            create_local_connection();
            handle_remote_description(JSON.parse(join_key.value));
            // const resp = await req.post('/api/decrypt/offer', { offer: join_key.value });
            // if (resp.status === 200) {
            //     join_key.value = resp.data.decrypted;
            //     create_local_connection();
            //     handle_remote_description(JSON.parse(resp.data.decrypted));
            // };
        })
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
    // let click_count = 0;
    function handle_mouse_event(e) {
        let x = e.clientX - this.offsetLeft;
        let y = e.clientY - this.offsetTop;
        const positions = { X: x, Y: y };
        console.log('current mouse positions are:', positions);
        let message;
        if (e.type === 'click') {
            message = { type: 'mouse', event: { type: e.type, positions, key: e.type === 'contextmenu' ? 'right' : 'left' } };
        } else if (e.type === 'mousemove') {
            message = { type: 'mouse', event: { type: e.type, positions } };
        }
        if (message) {
            local_connection.data_channel.send(JSON.stringify(message));
        }
    };

    function handle_key_event(e) {
        e.preventDefault()
        const message = { type: 'keyboard', event: { type: 'key', keyCode: e.keyCode, keys: { key: e.key, ctrlKey: e.ctrlKey ? 17 : false, shiftKey: e.shiftKey ? 16 : false, altKey: e.altKey ? 18 : false }, code: e.code } };
        local_connection.data_channel.send(JSON.stringify(message));
    };

    return {
        handle_mouse_event, handle_key_event
    };
};
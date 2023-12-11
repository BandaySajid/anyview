import * as firebase from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import * as store from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const peer_config = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
    ]
};

let join_btn = document.querySelector('.join-btn');
let offer_key = document.querySelector('#offer_key');
let join_key = document.querySelector('#joinee-key');
const video_elem = document.querySelector('video');
const join_type = window.location.pathname.split('/')[1];

let local_connection;
let localMediaStream;

const firebaseConfig = {
    apiKey: "AIzaSyCyt0ruF3qetpfowfKTBcxzvfRo1dCTylA",
    authDomain: "anyview-77972.firebaseapp.com",
    projectId: "anyview-77972",
    storageBucket: "anyview-77972.appspot.com",
    messagingSenderId: "417050409102",
    appId: "1:417050409102:web:6f38f1200aca32cc61f1df",
    measurementId: "G-5272S2SCPG"
};

const app = firebase.initializeApp(firebaseConfig);
const firestore = store.getFirestore(app);

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

const create_local_connection = async () => {
    let callDoc;
    let offerCandidates;
    let answerCandidates;
    let call_doc_id;

    if (join_type === 'host') {
        if (localStorage.getItem('room_id')) {
            call_doc_id = localStorage.getItem('room_id');
            callDoc = await store.doc(firestore, 'calls', call_doc_id);
        } else {
            let callsCollectionRef = store.collection(firestore, 'calls');
            callDoc = await store.addDoc(callsCollectionRef, {});
            call_doc_id = callDoc.id;
            localStorage.setItem('room_id', call_doc_id);
        };
    } else if (join_type === 'join') {
        call_doc_id = join_key.value;
        callDoc = await store.doc(firestore, 'calls', call_doc_id);
    };

    offerCandidates = store.collection(callDoc, 'offer');
    answerCandidates = store.collection(callDoc, 'answer');

    local_connection = new RTCPeerConnection(peer_config);

    local_connection.addEventListener('track', async (event) => {
        const [remoteStream] = event.streams;
        video_elem.srcObject = remoteStream;
    });

    if (join_type === 'host') {
        await set_media_tracks({
            video: { framerRate: 60, displaySurface: 'monitor' },
            audio: false,
        });
        handle_data_channel();
    } else {
        local_connection.ondatachannel = handle_data_channel;
    };

    local_connection.onicecandidate = (e) => {
        if (e.candidate) {
            if (join_type === 'host') {
                handle_on_ice_candidate(e.candidate.toJSON(), offerCandidates, call_doc_id);
            } else {
                handle_on_ice_candidate(e.candidate.toJSON(), answerCandidates);
            }
        }
    };

    if (join_type === 'host') {
        store.onSnapshot(callDoc, (snapshot) => {
            const data = snapshot.data();
            if (!local_connection.currentRemoteDescription && data?.answer) {
                handle_remote_description(data.answer)
            }
        });

        // When answered, add candidate to peer connection
        store.onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    local_connection.addIceCandidate(candidate);
                }
            });
        });
    } else if (join_type === 'join') {
        const callSnapshot = await store.getDoc(callDoc);
        const callData = callSnapshot.data();
        const offerDescription = callData.offer;
        await handle_remote_description(offerDescription, callDoc);

        store.onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    let data = change.doc.data();
                    local_connection.addIceCandidate(new RTCIceCandidate(data));
                }
            });
        });
    };

    // Listen for remote answer

    local_connection.oniceconnectionstatechange = (state) => {
        if (state === 'connected') {
            alert('Press F11 to fullscreen, otherwise there will be problems!');
        };
    };

    local_connection.onconnectionstatechange = handle_connection_state_change;

    if (join_type === 'host') {
        create_offer(callDoc);
    };
};

async function handle_on_ice_candidate(candidate, fire_candidates, call_doc_id) {
    if (join_type === 'host') {
        offer_key.value = call_doc_id;
        await store.addDoc(fire_candidates, candidate);
    } else if (join_type === 'join') {
        join_key.value = call_doc_id;
        await store.addDoc(fire_candidates, candidate);
    };
};

async function handle_remote_description(description, call_doc) {
    const final = new RTCSessionDescription(description);
    await local_connection.setRemoteDescription(final)
    if (join_type === 'join') {
        await create_answer(call_doc);
    };
};

async function create_offer(call_doc) {
    try {
        const offerDescription = await local_connection.createOffer();
        await local_connection.setLocalDescription(offerDescription);

        const offer = {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        };

        await store.setDoc(call_doc, { offer });

    } catch (error) {
        const err_msg = '[ERROR]: cannot create offer!';
        toast(err_msg, 'error');
        console.error(err_msg, error);
    };
};

async function create_answer(call_doc) {
    try {
        const answerDescription = await local_connection.createAnswer();
        await local_connection.setLocalDescription(answerDescription);

        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        await store.updateDoc(call_doc, { answer })

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
    if (ev.currentTarget.connectionState === 'connected') {
        if (join_type === 'host') {
            document.querySelector('.host-page').innerHTML = 'STREAMING TO THE PEER !!!';
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

    } else if (join_type === 'join') {
        join_btn.addEventListener('click', async (event) => {
            create_local_connection();
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
        }, 50);
    };

    function handle_key_event(e) {
        e.preventDefault()
        e = event_to_object(e);
        const message = { type: 'keyboard', event: e };

        //a little delay to prevent bombing
        const timeout = setTimeout(() => {
            local_connection.data_channel.send(JSON.stringify(message));
            clearTimeout(timeout);
        }, 50);
    };

    return {
        handle_mouse_event, handle_key_event
    };
};
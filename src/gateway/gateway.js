import { WebSocketServer } from 'ws';
import config from '../../config.js';
import {
    mouse,
    screen,
    getActiveWindow,
    keyboard,
    Key,
    Point,
} from '@nut-tree/nut-js';
import key_codes from '../utils/key_codes.js';

//518, 362

const screen_config = {
    width: await screen.width(),
    height: await screen.height(),
};

const get_coordinates = async (X, Y) => {
    const current_window = await getActiveWindow();
    const region = await current_window.region;

    const x = Math.floor(region.left + (X / screen_config.width) * screen_config.width);
    const y = Math.floor(region.top + (Y / screen_config.height) * screen_config.height);

    return new Point(x, y);
};

const send_mouse_input = async (event) => {
    if (event.type === 'click') {
        const mouse_position = await get_coordinates(event.positions.X, event.positions.Y);
        await mouse.setPosition(mouse_position);
        if (event.key === 'right') {
            await mouse.rightClick();
        } else if (mouse.key === 'left') {
            await mouse.leftClick();
        };
    }/*else if(event.type === 'mousemove'){
        await mouse.setPosition(mouse_position);
    };*/
};

const send_keyboard_input = async (event) => {
    if (event.keys.shiftKey && event.keyCode >= 65 && event.keyCode <= 90) {
        event.keys.keyname = key_codes[`${event.keyCode}`].toUpperCase();
    };

    let keys_to_press = Object.values(event.keys).filter(val => val); //will filter out null / undefined keys

    keys_to_press = keys_to_press.filter((key)=>{
        let code = key_codes[key];
        return Key[code];
    });

    await keyboard.pressKey(...keys_to_press);
    await keyboard.releaseKey(...keys_to_press);

};

const WSS = new WebSocketServer({ host: config.gateway.host, port: config.gateway.port });

WSS.on('connection', (socket) => {
    socket.on("message", async (message) => {
        try {
            const msg = JSON.parse(message);
            switch (msg.type) {
                case 'keyboard':
                    console.log('[KEYBOARD]: got an event', msg);
                    if (msg.event?.type === 'key') {
                        if (socket.prev_key.keys.shiftKey && msg.event.keys.shiftKey) {
                            socket.prev_key = msg.event;
                        } else {
                            console.log('triggering above keyboard event!');
                            await send_keyboard_input(msg.event);
                            socket.prev_key = msg.event;
                        };
                    };
                    break;
                case 'mouse':
                    console.log('[MOUSE]: got an event', msg);
                    if (msg.event?.type === 'click') {
                        console.log('triggering above mouse event!');
                        await send_mouse_input(msg.event);
                    };
                    break;
                default:
                    console.log('[UNSUPPORTED]: got an invalid message', msg);
                    socket.send(JSON.stringify({ type: 'error', error: 'only keyboard and mouse events can be sent!' }));
                    break;
            };
        } catch (err) {
            console.log('[ERROR]: Message is not a valid json:', { err: err, message: message.toString() });
        };
    });

    socket.on("error", (err) => {
        console.error('[client-socket]: Error with client socket:', err);
    });
});

WSS.on('error', (err) => {
    console.log('[WEBSOCKET]: Error with websocket server:', err);
});

WSS.on('listening', () => {
    keyboard.config.autoDelayMs = 10;
    mouse.config.autoDelayMs = 10;
    console.log('[WEBSOCKET]: Server is listening on:', WSS.address());
});

WSS.on('close', () => {
    console.log('[WEBSOCKET]: Server has been closed!');
});

export default WSS;
import { WebSocketServer } from 'ws';
import config from '../../config.js';
import {
    mouse,
    screen,
    getActiveWindow,
    keyboard,
    Key,
    Point,
    randomPointIn,
    centerOf,
    sleep,
    windowWithTitle,
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

    setInterval(()=>{
        console.log('current region w and h', screen_config.width, screen_config.height);
    }, 3000);

    // const x = Math.floor(region.left + (512 / width) * width);
    // const y = Math.floor(region.top + (362 / height) * height);

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
        event.keys.key = key_codes[`${event.keyCode}`].toUpperCase();
    };
    const keys_to_press = Object.values(event.keys).filter(val => val); //will filter out null / undefined keys
    await keyboard.pressKey(keys_to_press);
    await keyboard.releaseKey(keys_to_press);

    /*
    {
        type: 'keyboard',
        event: {
            type: 'key',
            keys : {
                key: 'r',
                ctrlKey: 17,
                shiftKey: 16,
                altKey: 18
            },
        keyCode: 82,
        code: 'KeyR'
      }
    }
    */
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
                        if (socket.prev_key.keys.shiftKey && msg.keys.shiftKey) {
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

/*
{
    type: 'keyboard',
    event: {
        type: 'key',
        key: 'r',
    keyCode: 82,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    code: 'KeyR'
  }
}

[MOUSE]: got an event {
  type: 'mouse',
  event: { type: 'click', positions: { X: 757, Y: 656 }, key: 'left' }
}
[MOUSE]: got an event {
  type: 'mouse',
  event: { type: 'mousemove', positions: { X: 757, Y: 616 } }
}

*/
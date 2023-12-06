const {
    mouse,
    screen,
    keyboard,
    Key,
    Point,
} = require('@nut-tree/nut-js');
const key_codes = require('../utils/key_codes.js');
const config = require('../../config.js');
const { WebSocketServer } = require('ws');

//518, 362

const get_coordinates = async (X, Y, client_width, client_height) => {
    const x = (X / client_width) * screen_config.width;
    const y = (Y / client_height) * screen_config.height;
    return new Point(x, y);
};

const send_mouse_input = async (event) => {
    if (event.type === 'click') {
        const mouse_position = await get_coordinates(event.positions.X, event.positions.Y, event.dimensions.width, event.dimensions.height);
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
    let keys_to_press = Object.values(event.keys).filter(val => val); //will filter out null / undefined keys

    keys_to_press = keys_to_press.map((key) => {
        let code = key_codes[key];
        return Key[code];
    });

    if (event.type === 'keydown') {
        await keyboard.pressKey(...keys_to_press);
    } else if (event.type === 'keyup') {
        await keyboard.releaseKey(...keys_to_press);
    };

};

const WSS = new WebSocketServer({ host: config.gateway.host, port: config.gateway.port });

WSS.on('connection', (socket) => {
    socket.on("message", async (message) => {
        try {
            const msg = JSON.parse(message);
            switch (msg.type) {
                case 'keyboard':
                    console.log('[KEYBOARD]: got an event', msg);
                    if (socket.prev_key?.keys.shiftKey && msg.event.keys.shiftKey) {
                        socket.prev_key = msg.event;
                    } else {
                        console.log('triggering above keyboard event!');
                        await send_keyboard_input(msg.event);
                        socket.prev_key = msg.event;
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

WSS.on('listening', async () => {
    keyboard.config.autoDelayMs = 10;
    mouse.config.autoDelayMs = 10;
    screen.config.dimensions = {
        width: await screen.width(),
        height: await screen.height(),
    };
    if(process.env.MODE === 'dev'){
        console.log('[WEBSOCKET]: Server is listening on:', WSS.address());
    };
});

WSS.on('close', () => {
    console.log('[WEBSOCKET]: Server has been closed!');
});

module.exports = WSS;
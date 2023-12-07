const {
    mouse,
    screen,
    keyboard,
    Key,
    Point,
    Button,
} = require('@nut-tree/nut-js');
const key_codes = require('../utils/key_codes.js');
const config = require('../../config.js');
const { WebSocketServer } = require('ws');
const log = require('../utils/log.js');

//518, 362

const get_coordinates = (X, Y, client_width, client_height) => {
    const x = (X / client_width) * screen.config.dimensions.width;
    const y = (Y / client_height) * screen.config.dimensions.height;
    return new Point(x, y);
};

const send_mouse_input = async (event) => {
    const mouse_position = get_coordinates(event.positions.X, event.positions.Y, event.dimensions.width, event.dimensions.height);
    switch (event.type) {
        case 'mousedown':
            await mouse.setPosition(mouse_position);
            await mouse.pressButton(event.button === 0 ? Button.LEFT : Button.RIGHT);
            break;
        case 'mouseup':
            await mouse.setPosition(mouse_position);
            await mouse.releaseButton(event.button === 0 ? Button.LEFT : Button.RIGHT);
            break;
        case 'mousemove':
            await mouse.setPosition(mouse_position);
            break;
    };
};

const send_keyboard_input = async (event) => {
    let keys_to_press = Object.values(event.keys).filter(val => val); //will filter out null / undefined keys

    keys_to_press = keys_to_press.map((key) => {
        let code = key_codes[`${key}`];
        return Key[`${code}`];
    });

    if (event.type === 'keyup') {
        await keyboard.pressKey(...keys_to_press);
        await keyboard.releaseKey(...keys_to_press);
    };

};

const WSS = new WebSocketServer({ host: config.gateway.host, port: config.gateway.port });

WSS.on('connection', (socket) => {
    socket.keyboard = {};
    socket.mouse = {};
    socket.on("message", async (message) => {
        try {
            const msg = JSON.parse(message);
            switch (msg.type) {
                case 'keyboard':
                    log('[KEYBOARD]: got an event', msg);
                    if (socket.keyboard.prev_event?.keys.shiftKey && msg.event.keys.shiftKey) {
                        socket.keyboard.prev_event = msg.event;
                    } else {
                        await send_keyboard_input(msg.event);
                        log('triggered above keyboard event!');
                        socket.keyboard.prev_event = msg.event;
                    };
                    break;
                case 'mouse':
                    log('[MOUSE]: got an event', msg.event);
                    await send_mouse_input(msg.event);
                    log('triggered above mouse event!');
                    break;
                default:
                    log('[UNSUPPORTED]: got an invalid message', msg);
                    socket.send(JSON.stringify({ type: 'error', error: 'only keyboard and mouse events can be sent!' }));
                    break;
            };
        } catch (err) {
            log('[ERROR]: Message is not a valid json:', { err: err, message: message.toString() });
        };
    });

    socket.on("error", (err) => {
        console.error('[client-socket]: Error with client socket:', err);
    });
});

WSS.on('error', (err) => {
    console.error('[WEBSOCKET]: Error with websocket server:', err);
});

WSS.on('listening', async () => {
    keyboard.config.autoDelayMs = 10;
    mouse.config.autoDelayMs = 10;
    screen.config.dimensions = {
        width: await screen.width(),
        height: await screen.height(),
    };
    log('[WEBSOCKET]: Server is listening on:', WSS.address());
});

WSS.on('close', () => {
    console.log('[WEBSOCKET]: Server has been closed!');
});

module.exports = WSS;
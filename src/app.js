import express from 'express';
// import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encrypt, decrypt } from './utils/cryptography.js';
import config from '../config.js';
import gateway from './gateway/gateway.js';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const pubic_path = path.join(__dirname, '../', 'public');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(pubic_path));

app.get('/', (req, res) => {
    res.sendFile(path.join(pubic_path, 'home.html'));
});

app.get('/host', (req, res) => {
    res.sendFile(path.join(pubic_path, 'host.html'));
});

app.get('/join', (req, res) => {
    res.sendFile(path.join(pubic_path, 'join.html'));
});

app.post('/api/encrypt/offer', (req, res) => {
    try {
        const { offer } = req.body;

        if (!offer) {
            return res.status(400).json({
                status: 'error',
                error: 'offer is required'
            });
        };

        const encrypted = encrypt(offer);

        return res.status(200).json({
            status: 'success',
            encrypted: encrypted
        });
    } catch (error) {
        console.log('an error occured with api:', error);
        return res.status(500).json({
            status: 'error',
            error: 'internal server error'
        });
    }
});

app.post('/api/encrypt/answer', (req, res) => {
    try {
        const { answer } = req.body;
        if (!answer) {
            return res.status(400).json({
                status: 'error',
                error: 'answer is required'
            });
        }
        const encrypted = encrypt(answer);

        return res.status(200).json({
            status: 'success',
            encrypted: encrypted
        });
    } catch (error) {
        console.log('an error occured with api:', error);
        return res.status(500).json({
            status: 'error',
            error: 'internal server error'
        });
    }
});

app.post('/api/decrypt/offer', (req, res) => {
    try {
        const { offer } = req.body;
        if (!offer) {
            return res.status(400).json({
                status: 'error',
                error: 'offer is required'
            });
        };

        const decrypted = decrypt(offer);

        return res.status(200).json({
            status: 'success',
            decrypted: decrypted
        });
    } catch (error) {
        console.log('an error occured with api:', error);
        return res.status(500).json({
            status: 'error',
            error: 'internal server error'
        });
    }
});
app.post('/api/decrypt/answer', (req, res) => {
    try {
        const { answer } = req.body;
        if (!answer) {
            return res.status(400).json({
                status: 'error',
                error: 'answer is required'
            });
        };

        const decrypted = decrypt(answer);

        return res.status(200).json({
            status: 'success',
            decrypted: decrypted
        });
    } catch (error) {
        console.log('an error occured with api:', error);
        return res.status(500).json({
            status: 'error',
            error: 'internal server error'
        });
    }
});

const server = http.createServer(app);

server.listen(config.http.port, config.http.host, () => {
    console.log('[HTTP] Server is listening on:', server.address());
});
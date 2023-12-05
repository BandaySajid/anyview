import express from 'express';
// import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const server = http.createServer(app);

server.listen(config.http.port, config.http.host, () => {
    console.log('[HTTP] Server is listening on:', server.address());
});
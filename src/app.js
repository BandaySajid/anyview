const express = require('express');
const path = require('node:path');
const config = require('../config.js');
const gateway = require('./gateway/gateway.js');
const http = require('node:http');

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
import crypto from 'node:crypto';
import config from '../../config.js';

const iv = crypto.randomBytes(16);
const enc_key = config.cryptograhy.enc_key;
const ALGORITHM = 'aes-256-cbc';

const encrypt = (plaintext) => {
    const cipher = crypto.createCipheriv(ALGORITHM, enc_key, iv);
    let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

const decrypt = (cipher) => {
    const decipher = crypto.createDecipheriv(ALGORITHM, enc_key, iv);
    let decrypted = decipher.update(cipher, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
};

export { encrypt, decrypt };
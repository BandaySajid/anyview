//logging for dev mode

module.exports = (...args) => {
    if (process.env.MODE === 'DEV') {
        console.log(...args);
    };
};
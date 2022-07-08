const path = require("path");

module.exports = {
    mode: "production",
    entry: path.resolve(__dirname, "./src/browser.ts"),
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [ ".ts", ".js"],
    },
    output: {
        filename: "portofino-commander.js",
        path: path.resolve(__dirname, "public", "static", "bundle"),
    },
};
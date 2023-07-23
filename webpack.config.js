const path = require("path");
const fs = require("fs");

const version = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./package.json")).toString()).version;

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
        filename: `portofino-commander-${version}-bundle.js`,
        path: path.resolve(__dirname, "public", "static", "bundle"),
    },
};

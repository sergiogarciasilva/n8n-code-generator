const path = require('path');
const webpack = require('webpack');

module.exports = {
    mode: 'production',
    entry: {
        sidebar: './src/webview-ui/sidebar.tsx',
        'visual-editor': './src/webview-ui/visual-editor.tsx'
    },
    output: {
        path: path.resolve(__dirname, 'out', 'webview-ui'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx']
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader', 'postcss-loader']
            }
        ]
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production')
        })
    ],
    externals: {
        vscode: 'commonjs vscode'
    }
};
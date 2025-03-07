import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
    },
    resolve: {
        alias: [
            {
                find: /^@elizaos\/core$/,
                replacement: path.resolve(__dirname, '../core/src/index.ts')
            },
            {
                find: /^attps-sdk-js$/,
                replacement: path.resolve(__dirname, '../../node_modules/attps-sdk-js/dist/index.cjs')
            }
        ]
    }
});

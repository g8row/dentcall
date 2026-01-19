import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        // Use node environment for unit tests (faster, no jsdom ESM issues)
        environment: 'node',
        globals: true,
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: ['node_modules', '.next'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules',
                '.next',
            ],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});

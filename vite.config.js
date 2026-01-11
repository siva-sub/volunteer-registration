import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    base: '/volunteer-registration/',
    build: {
        rollupOptions: {
            input: {
                main: resolve('index.html'),
                admin: resolve('admin/index.html'),
                cancel: resolve('cancel.html'),
                checkin: resolve('checkin.html'),
                feedback: resolve('feedback.html'),
            },
        },
    },
})

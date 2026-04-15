import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
    envDir: "..",
    plugins: [react()],
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test-setup.ts"],
        globals: true,
        exclude: ["e2e/**", "node_modules/**"],
    },
})

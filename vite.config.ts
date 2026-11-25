import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";

export default defineConfig({
  plugins: [tailwindcss(), voidPlugin(), voidReact({ react: { compiler: true } })],
  resolve: {
    tsconfigPaths: true,
  },
});

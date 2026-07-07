// Runs `next dev` with an isolated build directory (NEXT_DIST_DIR), so an
// assistant's preview session never shares webpack's persistent cache with
// whatever `npm run dev` you already have running. Two processes writing
// the same .next/cache/webpack/* concurrently is a real, observed cause of
// "__webpack_modules__[moduleId] is not a function" dev-server crashes.
// Plain `npm run dev` is completely unaffected -- it doesn't go through
// this script, so it keeps using the default ".next" as always.
const { spawn } = require("child_process");

// shell: true is required on Windows to spawn npx (a .cmd file) reliably --
// without it, spawn can fail with EINVAL depending on the Node version/
// environment. Passing the whole command as one string (rather than a
// separate args array) avoids Node's shell+args escaping warning; there's
// no injection risk here since the command is a fixed literal, not
// user-controlled input.
const child = spawn("npx next dev", {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_DIST_DIR: ".next-preview" },
});

child.on("exit", (code) => process.exit(code ?? 0));

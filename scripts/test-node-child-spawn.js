const { spawnSync } = require("child_process");

function run(label, command, args, cwd) {
  const result = spawnSync(command, args, { encoding: "utf8", cwd });

  return {
    label,
    command,
    args,
    cwd,
    status: result.status,
    signal: result.signal,
    error: result.error
      ? {
          code: result.error.code,
          errno: result.error.errno,
          syscall: result.error.syscall,
          message: result.error.message,
        }
      : null,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

const tests = [
  run("spawn node (inherit cwd)", process.execPath, ["-v"]),
  run("spawn node (C:\\ cwd)", process.execPath, ["-v"], "C:\\"),
  run("spawn cmd (inherit cwd)", "C:\\Windows\\System32\\cmd.exe", ["/c", "echo", "ok"]),
  run("spawn cmd (C:\\ cwd)", "C:\\Windows\\System32\\cmd.exe", ["/c", "echo", "ok"], "C:\\"),
  run("spawn where (inherit cwd)", "C:\\Windows\\System32\\where.exe", ["node"]),
  run("spawn where (C:\\ cwd)", "C:\\Windows\\System32\\where.exe", ["node"], "C:\\"),
  run("spawn powershell (inherit cwd)", "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"]),
  run("spawn powershell (C:\\ cwd)", "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], "C:\\"),
];

console.log(
  JSON.stringify(
    {
      processExecPath: process.execPath,
      tests,
    },
    null,
    2
  )
);

#!/usr/bin/env python3
"""Deploy the pinned Needle release on its existing Docker/Caddy host."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

RELEASE = "c4b795966636428b39e96e9a05cce77b2f747f50"
REPOSITORY = "https://github.com/miguelalmeida0/needle-portfolio-release.git"
DOMAIN = "needle.miguelalmeida.xyz"
ASSETS = {
    "/assets/bootstrap-6C9FF544.js": "6c9ff5448f0eac50166f84940fe44de2ba0cccc143d9abb511e5367764892646",
    "/assets/redesign-3201AD3B.css": "3201ad3b807f673c82db65dd9f24dfbb970888c9bc09081217d1204c98933c43",
    "/assets/search-relevant-BA61762A.js": "ba61762a8089b4b36a31c88c77f11090fdd0885dfe6a9c1467b9731d05676d7f"
}


def run(*args, capture=True):
    result = subprocess.run(args, stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.PIPE if capture else None, check=False,
                            umask=0o022 if args[0] == "git" else -1)
    if result.returncode:
        # Commands and captured output can include environment credentials.
        raise RuntimeError(f"{args[0]} operation failed (exit {result.returncode})")
    return result.stdout.decode().strip() if capture else ""


def contract(info):
    host, config = info["HostConfig"], info["Config"]
    expected_ports = {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8000"}]}
    if not info["State"]["Running"]:
        raise RuntimeError("Existing needle container must be running")
    if info.get("Mounts") or host.get("Binds") or host.get("Mounts"):
        raise RuntimeError("Unexpected storage mounts; existing container was not changed")
    if (config.get("User") != "node" or host.get("NetworkMode") != "bridge"
            or host.get("PortBindings") != expected_ports
            or host.get("RestartPolicy") != {"Name": "unless-stopped", "MaximumRetryCount": 0}):
        raise RuntimeError("Runtime settings differ from the inspected deployment")
    if (host.get("Privileged") or host.get("CapAdd") or host.get("Devices")
            or host.get("SecurityOpt") or host.get("ReadonlyRootfs")
            or host.get("Memory") or host.get("NanoCpus") or host.get("ExtraHosts")
            or host.get("Dns") or host.get("PidMode") or host.get("IpcMode", "private") != "private"):
        raise RuntimeError("Custom runtime constraints need preservation before deployment")
    env = config.get("Env") or []
    values = dict(entry.split("=", 1) for entry in env)
    cache = values.get("NEEDLE_IMAGE_CACHE_ROOT", "/app/.needle-cache/derivatives")
    if not cache.startswith("/app/.needle-cache/") or ".." in Path(cache).parts:
        raise RuntimeError("Unexpected cache location; existing container was not changed")
    return env, cache


def verify(base, fetch=None):
    if fetch is None:
        def fetch(path):
            with urllib.request.urlopen(base + path, timeout=15) as response:
                return response.read()
    html = fetch("/")
    expected_bootstrap = next(iter(ASSETS)).encode("ascii")
    if expected_bootstrap not in html:
        raise RuntimeError("Unexpected HTML release")
    for path, expected in ASSETS.items():
        if hashlib.sha256(fetch(path)).hexdigest() != expected:
            raise RuntimeError("Asset checksum mismatch: " + path)


def await_ready(base):
    deadline = time.monotonic() + 60
    while True:
        try:
            verify(base)
            return
        except Exception:
            if time.monotonic() >= deadline:
                raise
            time.sleep(1)


def deploy(root, command=run, ready=await_ready, public_check=None):
    info = json.loads(command("docker", "inspect", "needle"))[0]
    env, cache = contract(info)
    stamp = str(time.time_ns())
    candidate, next_name = "needle-check-" + stamp, "needle-next-" + stamp
    backup, failed = "needle-rollback-" + stamp, "needle-failed-" + stamp
    root = Path(root)
    release_dir = root / "source"
    # Private state is retained for diagnosis; never print its environment values.
    (root / "previous-container.json").write_text(json.dumps(info, indent=2))
    os.chmod(root / "previous-container.json", 0o600)
    command("git", "init", str(release_dir))
    command("git", "-C", str(release_dir), "remote", "add", "origin", REPOSITORY)
    command("git", "-C", str(release_dir), "fetch", "--depth=1", "origin", RELEASE)
    command("git", "-C", str(release_dir), "checkout", "--detach", "FETCH_HEAD")
    if command("git", "-C", str(release_dir), "rev-parse", "HEAD") != RELEASE:
        raise RuntimeError("Source commit mismatch")
    image = "needle-portfolio:" + RELEASE[:12]
    print("Building pinned release; the current app stays online.", flush=True)
    command("docker", "build", "--tag", image, str(release_dir), capture=False)
    command("docker", "run", "--rm", image, "node", "scripts/verify-release.mjs", capture=False)
    saved_cache = root / "cache"
    saved_cache.mkdir()
    command("docker", "cp", "--archive", "needle:" + cache + "/.", str(saved_cache))
    runtime = ["--user", "node", "--network", "bridge",
               "--workdir", info["Config"].get("WorkingDir") or "/app"]
    for entry in env:
        runtime += ["--env", entry]
    # Retain an existing command/entrypoint override, if present.
    entrypoint = info["Config"].get("Entrypoint") or []
    if entrypoint:
        runtime += ["--entrypoint", entrypoint[0]]
    image_command = entrypoint[1:] + (info["Config"].get("Cmd") or [])
    stopped = renamed = promoted = False
    created = []

    def create(name, port, restart):
        command("docker", "create", "--name", name, "--restart", restart,
                "--publish", port, *runtime, image, *image_command)
        created.append(name)
        command("docker", "cp", "--archive", str(saved_cache) + "/.", name + ":" + cache + "/")
        command("docker", "start", name)
        command("docker", "exec", name, "node", "-e",
                "require('node:fs').accessSync(process.argv[1], require('node:fs').constants.W_OK)", cache)

    try:
        create(candidate, "127.0.0.1::8000", "no")
        bindings = json.loads(command("docker", "inspect", "--format", "{{json .NetworkSettings.Ports}}", candidate))
        ready("http://127.0.0.1:" + bindings["8000/tcp"][0]["HostPort"])
        command("docker", "stop", candidate)
        # Copy any cache warmed by the candidate before the brief switch.
        command("docker", "cp", "--archive", candidate + ":" + cache + "/.", str(saved_cache))
        command("docker", "rm", candidate)
        created.remove(candidate)
        current = json.loads(command("docker", "inspect", "needle"))[0]
        if any(current.get(key) != info.get(key) for key in ("Id", "Config", "HostConfig")):
            raise RuntimeError("Existing deployment changed during the build; switch cancelled")
        contract(current)
        print("Candidate passed. Switching the existing loopback service.", flush=True)
        # Mark before stop so interruption or an ambiguous failure also restarts the old container.
        stopped = True
        command("docker", "stop", "--time", "20", "needle")
        command("docker", "rename", "needle", backup)
        renamed = True
        # Use next_name until its create/copy/start sequence has completed.
        create(next_name, "127.0.0.1:8000:8000", "unless-stopped")
        command("docker", "rename", next_name, "needle")
        created.remove(next_name)
        promoted = True
        ready("http://127.0.0.1:8000")
        if public_check is None:
            def public_check():
                def fetch(path):
                    result = subprocess.run([
                        "curl", "--fail", "--silent", "--show-error", "--max-time", "20",
                        "--resolve", DOMAIN + ":443:127.0.0.1", "https://" + DOMAIN + path,
                    ], check=True, stdout=subprocess.PIPE)
                    return result.stdout
                verify("https://" + DOMAIN, fetch)
        public_check()
    except BaseException:
        if promoted:
            command("docker", "stop", "needle")
            command("docker", "rename", "needle", failed)
        for name in created:
            command("docker", "rm", "--force", name)
        if renamed:
            command("docker", "rename", backup, "needle")
        if stopped:
            command("docker", "start", "needle")
            print("Deployment failed; the previous container was restored.", flush=True)
        raise
    print("DEPLOYED: https://" + DOMAIN + "/", flush=True)
    print("Verified HTML, JS, CSS, search worker and Caddy HTTPS. Old container: " + backup, flush=True)
    print("Cache snapshot and private runtime backup: " + str(root), flush=True)


def main():
    if os.geteuid() != 0:
        raise RuntimeError("Run from the existing root SSH prompt")
    for tool in ("docker", "git", "curl"):
        if not shutil.which(tool):
            raise RuntimeError("Required tool missing: " + tool)
    lock = open("/var/lock/needle-deploy.lock", "w")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    base = Path("/opt/apps/needle-releases")
    base.mkdir(parents=True, exist_ok=True)
    if shutil.disk_usage(base).free < 2 * 1024 ** 3:
        raise RuntimeError("At least 2 GB free disk space required")
    os.umask(0o077)
    deploy(tempfile.mkdtemp(prefix="deploy-" + RELEASE[:12] + "-", dir=base))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("STOPPED: " + str(error), file=sys.stderr)
        sys.exit(1)

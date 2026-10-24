"""Exercise deploy ordering and recovery without contacting a host or Docker."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("deployment", Path(__file__).parents[1] / "scripts/deploy-hetzner.py")
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)

INFO = {
    "State": {"Running": True}, "Mounts": [],
    "Config": {"User": "node", "WorkingDir": "/app", "Env": ["CUSTOM_SETTING=preserved"],
               "Entrypoint": ["docker-entrypoint.sh"], "Cmd": ["node", "scripts/serve.mjs"]},
    "HostConfig": {"NetworkMode": "bridge", "RestartPolicy": {"Name": "unless-stopped", "MaximumRetryCount": 0},
                   "PortBindings": {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8000"}]}},
}


class Host:
    def __init__(self, failure=None):
        self.calls = []
        self.containers = {"needle": {"running": True, "original": True}}
        self.failure = failure

    def run(self, *args, **kwargs):
        self.calls.append(args)
        if args[:3] == ("docker", "inspect", "needle"):
            return json.dumps([INFO])
        if args[0] == "git":
            return deployment.RELEASE if args[-1] == "HEAD" else ""
        if args[:3] == ("docker", "inspect", "--format"):
            return json.dumps({"8000/tcp": [{"HostPort": "45678"}]})
        if args[0] != "docker":
            return ""
        action = args[1]
        if action == "build" and self.failure == "build":
            raise RuntimeError("build failed")
        if action == "create":
            name = args[args.index("--name") + 1]
            self.containers[name] = {"running": False, "original": False}
        if action == "start":
            if args[2].startswith("needle-next-") and self.failure == "start":
                raise RuntimeError("new container failed to start")
            self.containers[args[2]]["running"] = True
        if action == "stop":
            self.containers[args[-1]]["running"] = False
        if action == "rename":
            self.containers[args[3]] = self.containers.pop(args[2])
        if action == "rm":
            self.containers.pop(args[-1])
        return ""

    def ready(self, base):
        if (self.failure == "candidate" and base.endswith("45678")) or (self.failure == "production" and base.endswith(":8000")):
            raise RuntimeError("release validation failed")

    def public(self):
        if self.failure == "https":
            raise RuntimeError("Caddy check failed")


class DeploymentTests(unittest.TestCase):
    def execute(self, host):
        with tempfile.TemporaryDirectory() as root:
            deployment.deploy(root, host.run, host.ready, host.public)

    def test_success_preserves_environment_cache_and_old_container(self):
        host = Host()
        self.execute(host)
        self.assertTrue(host.containers["needle"]["running"])
        originals = [state for state in host.containers.values() if state["original"]]
        self.assertEqual(originals, [{"running": False, "original": True}])
        creates = [call for call in host.calls if call[:2] == ("docker", "create")]
        self.assertEqual(len(creates), 2)
        for call in creates:
            self.assertIn("CUSTOM_SETTING=preserved", call)
            self.assertIn("docker-entrypoint.sh", call)
        copies = [call for call in host.calls if call[:2] == ("docker", "cp")]
        self.assertEqual(len(copies), 4)
        self.assertTrue(all(call[2] == "--archive" for call in copies))

    def test_preflight_failure_never_stops_original(self):
        for failure in ("build", "candidate"):
            with self.subTest(failure=failure):
                host = Host(failure)
                with self.assertRaises(RuntimeError):
                    self.execute(host)
                self.assertEqual(host.containers, {"needle": {"running": True, "original": True}})
                self.assertFalse(any(call[:2] == ("docker", "stop") and call[-1] == "needle" for call in host.calls))

    def test_failure_after_switch_restores_original(self):
        for failure in ("start", "production", "https"):
            with self.subTest(failure=failure):
                host = Host(failure)
                with self.assertRaises(RuntimeError):
                    self.execute(host)
                self.assertEqual(host.containers["needle"], {"running": True, "original": True})

    def test_unexpected_mounts_and_runtime_are_rejected(self):
        for mutate in (
            lambda info: info.update(Mounts=[{"Source": "/important"}]),
            lambda info: info["HostConfig"].update(NetworkMode="host"),
            lambda info: info["Config"].update(Env=["NEEDLE_IMAGE_CACHE_ROOT=/outside"]),
        ):
            info = copy.deepcopy(INFO)
            mutate(info)
            with self.assertRaises(RuntimeError):
                deployment.contract(info)

    def test_wrong_html_or_asset_bytes_fail_validation(self):
        with self.assertRaises(RuntimeError):
            deployment.verify("unused", lambda path: b"old release")
        with self.assertRaisesRegex(RuntimeError, "checksum"):
            deployment.verify("unused", lambda path: next(iter(deployment.ASSETS)).encode() if path == "/" else b"corrupt")


if __name__ == "__main__":
    unittest.main()

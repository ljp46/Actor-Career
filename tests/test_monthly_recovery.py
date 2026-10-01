import importlib.util
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import recover_months as months


def chunk(month, projects=None):
    return json.dumps({"year": 2013, "month": month, "source": "TMDB", "scope": "hollywood",
                       "complete": True, "batchVersion": 1, "projects": projects or []}).encode()


class MonthlyRecoveryTests(unittest.TestCase):
    def test_does_not_merge_an_incomplete_year(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            (path / "01.json").write_bytes(chunk(1))
            self.assertIsNone(months.merge_chunks(path, 2013))

    def test_merge_deduplicates_and_keeps_all_twelve_months(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)
            for month in range(1, 13):
                project = {"id": f"film-{month}", "year": 2013, "title": str(month), "roles": []}
                shared = {"id": "shared", "year": 2013, "title": "Shared", "roles": []}
                (path / f"{month:02d}.json").write_bytes(chunk(month, [project, shared]))
            payload = json.loads(months.merge_chunks(path, 2013))
            self.assertEqual(len(payload["projects"]), 13)
            self.assertNotIn("month", payload)

    def test_rejects_unfinished_or_mismatched_month(self):
        payload = json.loads(chunk(1))
        payload["complete"] = False
        with self.assertRaises(ValueError):
            months.validate_chunk(json.dumps(payload), 2013, 1)
        with self.assertRaises(ValueError):
            months.validate_chunk(chunk(1), 2013, 2)

    def test_import_skips_a_completed_month(self):
        def existing(branch, path):
            return chunk(2).decode() if path.endswith("/02.json") else None
        with patch.object(months, "command"), patch.object(months, "remote_content", side_effect=existing), \
             patch.object(months.subprocess, "run") as run:
            months.import_month("backup", 2013, 2)
            run.assert_not_called()

    def test_network_failure_does_not_mark_month_complete(self):
        spec = importlib.util.spec_from_file_location("importer_monthly", ROOT / "scripts/import_tmdb.py")
        importer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(importer)
        importer.TOKEN = "test-only"
        with tempfile.TemporaryDirectory() as directory:
            importer.ROOT = pathlib.Path(directory)
            with patch.object(sys, "argv", ["import", "--start", "2013", "--end", "2013", "--month", "1"]), \
                 patch.object(importer, "discover_range", return_value=iter([{"id": 1}])), \
                 patch.object(importer, "convert", side_effect=TimeoutError("exhausted retries")):
                with self.assertRaises(TimeoutError):
                    importer.main()
            self.assertFalse((importer.ROOT / "data/recovery/2013/01.json").exists())

    def test_plan_skips_saved_year_and_saved_month(self):
        jobs = {"jobs": [{"name": "import-year (1965)", "conclusion": "failure"},
                         {"name": "import-year (2013)", "conclusion": "cancelled"},
                         {"name": "import-year (2018)", "conclusion": None}]}
        saved_year = json.dumps({"year": 1965, "source": "TMDB", "scope": "hollywood",
                                "projects": [{"id": "a", "year": 1965, "roles": []}]})
        def existing(branch, path):
            if path == "data/years/1965.json":
                return saved_year
            if path == "data/recovery/2013/01.json":
                return chunk(1).decode()
            return None
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "output"
            with patch.object(months, "command"), patch.object(months, "github_get", return_value=jobs), \
                 patch.object(months, "remote_content", side_effect=existing), \
                 patch.dict(os.environ, {"GITHUB_OUTPUT": str(output)}):
                months.prepare("test/repo", "test", 1, "backup")
            lines = dict(line.split("=", 1) for line in output.read_text().splitlines())
            self.assertEqual(lines["has_work"], "true")
            plan = json.loads(lines["matrix"])["include"]
            self.assertEqual(plan, [{"year": 2013, "month": month} for month in range(2, 13)])

    def test_concurrent_commit_is_kept_after_push_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            remote, local, competitor = root / "remote.git", root / "local", root / "competitor"
            def git(*args, cwd=None):
                return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True)
            git("init", "--bare", str(remote))
            git("clone", str(remote), str(local))
            git("config", "user.name", "Test", cwd=local)
            git("config", "user.email", "test@example.invalid", cwd=local)
            (local / "data/years").mkdir(parents=True)
            (local / "data/years/index.json").write_text("{}")
            git("add", ".", cwd=local)
            git("commit", "-m", "initial", cwd=local)
            git("push", "origin", "HEAD:refs/heads/backup", cwd=local)
            git("clone", "--branch", "backup", str(remote), str(competitor))
            git("config", "user.name", "Test", cwd=competitor)
            git("config", "user.email", "test@example.invalid", cwd=competitor)
            original = months.command
            raced = False
            def race(*args, **kwargs):
                nonlocal raced
                if args[:2] == ("git", "push") and not raced:
                    raced = True
                    other = competitor / "data/recovery/2013/02.json"
                    other.parent.mkdir(parents=True)
                    other.write_bytes(chunk(2))
                    git("add", ".", cwd=competitor)
                    git("commit", "-m", "other month", cwd=competitor)
                    git("push", "origin", "backup", cwd=competitor)
                return original(*args, **kwargs)
            with patch.object(months, "ROOT", local), patch.object(months, "command", side_effect=race), \
                 patch.object(months.time, "sleep"):
                months.save_chunk("backup", 2013, 1, chunk(1))
            self.assertTrue(raced)
            git("fetch", "origin", "backup:refs/remotes/origin/backup", cwd=local)
            for month in (1, 2):
                raw = git("show", f"origin/backup:data/recovery/2013/{month:02d}.json", cwd=local).stdout
                months.validate_chunk(raw, 2013, month)


if __name__ == "__main__":
    unittest.main()

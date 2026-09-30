import http.client
import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


recover = module("recover_catalogue")
importer = module("import_tmdb")


def archive(filename, payload):
    result = io.BytesIO()
    with zipfile.ZipFile(result, "w") as zipfile_out:
        zipfile_out.writestr(filename, json.dumps(payload))
    return result.getvalue()


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.payload = {"year": 1965, "source": "TMDB", "scope": "hollywood",
                        "projects": [{"id": "tmdb-movie-1", "year": 1965, "roles": []}]}

    def test_accepts_matching_shard(self):
        raw = recover.extract_year(archive("1965.json", self.payload), 1965)
        self.assertEqual(json.loads(raw)["year"], 1965)

    def test_rejects_zip_paths_and_wrong_year(self):
        with self.assertRaises(ValueError):
            recover.extract_year(archive("../../1965.json", self.payload), 1965)
        with self.assertRaises(ValueError):
            recover.extract_year(archive("1964.json", self.payload), 1964)

    def test_rejects_empty_or_duplicate_productions(self):
        self.payload["projects"] = []
        with self.assertRaises(ValueError):
            recover.validate_year(json.dumps(self.payload), 1965)
        self.payload["projects"] = [{"id": "a", "year": 1965, "roles": []}] * 2
        with self.assertRaises(ValueError):
            recover.validate_year(json.dumps(self.payload), 1965)

    def test_importer_retries_remote_disconnect(self):
        importer.TOKEN = "test-only"
        with patch.object(importer.urllib.request, "urlopen", side_effect=[
            http.client.RemoteDisconnected("closed"), io.BytesIO(b'{"ok": true}')
        ]) as opening, patch.object(importer.time, "sleep"):
            self.assertEqual(importer.request("/movie/1"), {"ok": True})
            self.assertEqual(opening.call_count, 2)

    def test_artifact_redirect_does_not_forward_token(self):
        class Redirect:
            def open(self, request, timeout):
                raise recover.urllib.error.HTTPError(request.full_url, 302, "redirect",
                                                     {"Location": "https://storage.example/file.zip"}, None)
        with patch.object(recover.urllib.request, "build_opener", return_value=Redirect()), \
             patch.object(recover.urllib.request, "urlopen", return_value=io.BytesIO(b"zip")) as opening:
            self.assertEqual(recover.github_get("https://api.github.com/example", "secret", True), b"zip")
            self.assertEqual(opening.call_args.args[0], "https://storage.example/file.zip")


if __name__ == "__main__":
    unittest.main()

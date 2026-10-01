import pathlib
import sys
import unittest
from unittest.mock import patch, call

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "scripts"))
import stop_full_year_builds as stop


class StopBuildTests(unittest.TestCase):
    def test_only_named_runs_are_cancelled_and_old_workflow_disabled(self):
        def response(path, method="GET"):
            if method == "GET":
                return {"name": "Build Historical Database", "head_branch": "main", "status": "in_progress"}
        with patch.object(stop, "call", side_effect=response) as api:
            stop.main()
            self.assertEqual(api.call_args_list, [
                call("actions/runs/36386406355"), call("actions/runs/36386406355/cancel", "POST"),
                call("actions/runs/36852230780"), call("actions/runs/36852230780/cancel", "POST"),
                call("actions/workflows/build-historical-database.yml/disable", "PUT")])

    def test_wrong_workflow_identity_stops_without_mutation(self):
        with patch.object(stop, "call", return_value={"name": "Other workflow", "head_branch": "main"}) as api:
            with self.assertRaises(RuntimeError):
                stop.main()
            api.assert_called_once_with("actions/runs/36386406355")


if __name__ == "__main__":
    unittest.main()

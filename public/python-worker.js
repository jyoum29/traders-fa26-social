let pyodidePromise;

async function getPyodide() {
  if (!pyodidePromise) {
    importScripts("/pyodide/pyodide.js");
    pyodidePromise = loadPyodide({ indexURL: "/pyodide/" });
  }
  return pyodidePromise;
}

self.onmessage = async ({ data }) => {
  try {
    const pyodide = await getPyodide();
    pyodide.globals.set("submitted_code", data.code);
    const result = await pyodide.runPythonAsync(`
import json
import io
import traceback
from contextlib import redirect_stdout

cases = [
    {"nums": [2, 7, 11, 15], "target": 9},
    {"nums": [3, 2, 4], "target": 6},
    {"nums": [3, 3], "target": 6},
    {"nums": [-5, 8, 12, 1], "target": 7},
    {"nums": [0, 4, 3, 0], "target": 0},
    {"nums": [1000000, -3, 7, 11, 2], "target": 999997},
]

try:
    namespace = {}
    exec(submitted_code, namespace)
    solution = namespace.get("two_sum")
    if not callable(solution):
        raise ValueError("Define a function named two_sum(nums, target).")

    results = []
    for case in cases:
        nums = case["nums"]
        target = case["target"]
        printed = io.StringIO()
        with redirect_stdout(printed):
            output = solution(nums.copy(), target)
        valid = (
            isinstance(output, (list, tuple))
            and len(output) == 2
            and all(isinstance(i, int) and not isinstance(i, bool) for i in output)
            and output[0] != output[1]
            and all(0 <= i < len(nums) for i in output)
            and nums[output[0]] + nums[output[1]] == target
        )
        results.append({
            "nums": nums,
            "target": target,
            "output": output if isinstance(output, (list, tuple, int, float, str, bool, type(None))) else repr(output),
            "passed": valid,
            "stdout": printed.getvalue(),
        })
    payload = {"ok": True, "results": results}
except Exception:
    payload = {"ok": False, "error": traceback.format_exc(limit=4)}

json.dumps(payload)
`);
    self.postMessage(JSON.parse(result));
  } catch (error) {
    self.postMessage({
      ok: false,
      error: `Python could not start.\n${error.message}`,
    });
  }
};

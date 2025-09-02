from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # ✅ 開啟跨域

@app.route("/ocr_rename", methods=["POST"])
def ocr_rename():
    data = request.json
    report_type = data.get("report_type")
    folder = data.get("folder")

    if not report_type or not folder:
        return jsonify({"error": "缺少參數"}), 400

    script = os.path.join("backend", "ocr_engine", "ocr_rename.py")
    result = subprocess.run(
        ["python", script, report_type, folder],
        capture_output=True,
        text=True
    )

    output = result.stdout.strip()

    # ⬇️ 防呆：如果沒有正確輸出，就直接回錯誤訊息
    if not output or "," not in output:
        return jsonify({
            "error": "Python 腳本沒有回傳有效結果",
            "stdout": output,
            "stderr": result.stderr
        }), 500

    try:
        success, fail = map(int, output.split(","))
        return jsonify({"success": success, "fail": fail})
    except Exception as e:
        return jsonify({
            "error": f"解析錯誤: {str(e)}",
            "stdout": output,
            "stderr": result.stderr
        }), 500

@app.route("/pdf_stamp", methods=["POST"])
def pdf_stamp():
    data = request.json
    input_folder = data.get("input_folder")
    output_folder = data.get("output_folder")
    stamp_img = data.get("stamp_img")

    if not input_folder or not output_folder or not stamp_img:
        return jsonify({"error": "缺少參數"}), 400

    script = os.path.join("backend", "ocr_engine", "pdf_stamp.py")
    result = subprocess.run(
        ["python", script, input_folder, output_folder, stamp_img],
        capture_output=True,
        text=True
    )

    output = result.stdout.strip()
    try:
        success, fail = map(int, output.split(","))
        return jsonify({"success": success, "fail": fail})
    except Exception as e:
        return jsonify({"error": str(e), "stderr": result.stderr})

if __name__ == "__main__":
    app.run(port=5000)

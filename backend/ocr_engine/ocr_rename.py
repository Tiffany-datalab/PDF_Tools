APP_VERSION = "1.0.0"

import os
import re
import sys
from pdf2image import convert_from_path
import pytesseract
from PIL import Image, ImageOps

if getattr(sys, 'frozen', False):
    # exe 模式
    BASE_DIR = os.path.dirname(sys.executable)
else:
    # dev 模式 → 回到 backend
    BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# === Tesseract 路徑 ===
tesseract_path = os.path.join(os.path.dirname(BASE_DIR), "tesseract", "tesseract.exe")
pytesseract.pytesseract.tesseract_cmd = tesseract_path

# === Poppler 路徑 ===
poppler_path = os.path.join(os.path.dirname(BASE_DIR), "poppler", "bin")

def normalize(s):
    s = s.upper()
    s = s.replace("O", "0").replace("I", "1").replace("L", "1")
    s = s.replace("﹣", "-").replace("‐", "-").replace("–", "-").replace("—", "-")
    s = s.replace("%", "5")
    s = s.replace("鬥", "H").replace("鴛", "M").replace("冊", "M")
    s = s.replace("AI", "A1").replace("AL", "A1").replace("IL", "A1").replace("1L", "A1")

    parts = s.split('-')
    if len(parts) == 4:
        parts[1] = re.sub(r'T', '1', parts[1])
        parts[2] = re.sub(r'T', '1', parts[2])
        s = '-'.join(parts)

    if re.match(r"^\d{6}-\d{3}-\d{2}-[A-Z0-9]{2}$", s):
        s = "H" + s
    if re.match(r"^\d{2}-[A-Z]-\d{4}$", s):
        s = "MP" + s
    return s

def extract_report_id(pdf_path, report_type):
    try:
        poppler_path = os.path.join(BASE_DIR, "poppler", "bin")
        if os.path.exists(poppler_path):
            images = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=1, poppler_path=poppler_path)
        else:
            images = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=1)

        full_img = images[0].convert("L")

        if report_type == "食品檢驗報告":
            cropped_img = full_img.crop((1200, 100, 3000, 700))
        else:
            cropped_img = full_img.crop((1500, 370, 2200, 470))

        img = ImageOps.invert(cropped_img)
        img = img.point(lambda x: 0 if x < 180 else 255, "1")
        text = pytesseract.image_to_string(img, lang="chi_tra+eng")

        report_id = None
        match_food = re.search(r"(?:H|鬥)?\d{6}[-﹣]\d{3}[-﹣]\d{2}[-﹣][A-Z0-9]{2}", text.upper())
        match_env = re.search(r"MP\d{2}-[A-Z]-\d{4}", text.upper())

        if match_food:
            report_id = normalize(match_food.group(0))
        elif match_env:
            report_id = normalize(match_env.group(0))

        if not report_id:
            text_full = pytesseract.image_to_string(full_img, lang="chi_tra+eng")
            match_food = re.search(r"(?:H|鬥)?\d{6}[-﹣]\d{3}[-﹣]\d{2}[-﹣][A-Z0-9]{2}", text_full.upper())
            match_env = re.search(r"MP\d{2}-[A-Z]-\d{4}", text_full.upper())
            if match_food:
                report_id = normalize(match_food.group(0))
            elif match_env:
                report_id = normalize(match_env.group(0))

        return report_id
    except Exception as e:
        print(f"OCR 錯誤：{e}", file=sys.stderr)
        return None

def process_pdfs(source, report_type):
    pdf_files = [f for f in os.listdir(source) if f.lower().endswith(".pdf")]
    total = len(pdf_files)
    success, errors = [], []

    for file in pdf_files:
        original_path = os.path.join(source, file)
        report_id = extract_report_id(original_path, report_type)
        if report_id:
            new_path = os.path.join(source, f"{report_id}.pdf")
            try:
                os.replace(original_path, new_path)
                success.append(os.path.basename(new_path))
            except Exception:
                errors.append(file)
        else:
            errors.append(file)

    if errors:
        error_file = os.path.join(source, "OCR_Error_Files.txt")
        with open(error_file, "w", encoding="utf-8") as f:
            f.write("以下為 OCR 無法辨識或改名失敗的檔案：\n")
            for ef in errors:
                f.write(ef + "\n")

    return {"total": total, "success": success, "errors": errors}

def main():
    if len(sys.argv) < 3:
        print("0,0")
        sys.exit(1)

    report_type = sys.argv[1]
    input_folder = sys.argv[2]

    result = process_pdfs(input_folder, report_type)
    print(f"DEBUG: {result}", file=sys.stderr)
    print(f"{len(result['success'])},{len(result['errors'])}")

if __name__ == "__main__":
    main()

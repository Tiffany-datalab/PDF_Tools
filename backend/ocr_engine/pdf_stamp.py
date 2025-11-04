APP_VERSION = "1.0.0"

import fitz  # PyMuPDF
import os
import sys
from reportlab.pdfgen import canvas          # 🔸 新增
from reportlab.lib.utils import ImageReader  # 🔸 新增
from reportlab.lib.pagesizes import A4       # 🔸 新增
import tempfile                              # 🔸 新增

# 固定設定
STAMP_SIZE = 100
X_OFFSET = 360
PASSWORD = "HQTReport"

def make_stamp_pdf(stamp_img, size=STAMP_SIZE):
    """🔸 章圖轉成透明 PDF"""
    tmp_path = tempfile.mktemp(suffix=".pdf")
    c = canvas.Canvas(tmp_path, pagesize=(size, size))
    c.drawImage(ImageReader(stamp_img), 0, 0, size, size, mask='auto')  # ✅ mask='auto' 保留透明
    c.save()
    return tmp_path

def add_stamp(input_pdf, stamp_img, output_folder, y_offset):
    doc = fitz.open(input_pdf)
    found_flag = False

    # 🔸 先建立透明 PDF 章
    stamp_pdf = make_stamp_pdf(stamp_img)
    stamp_doc = fitz.open(stamp_pdf)

    for page_num, page in enumerate(doc, start=1):
        text_instances = page.search_for("報告簽署人")
        for inst in text_instances:
            found_flag = True
            x0, y0, x1, y1 = inst
            print(f"{input_pdf} 第 {page_num} 頁 -> (x0={x0}, y0={y0}, x1={x1}, y1={y1})", file=sys.stderr)

            new_x = x0 + X_OFFSET
            new_y = y0 + y_offset
            rect = fitz.Rect(new_x, new_y, new_x + STAMP_SIZE, new_y + STAMP_SIZE)

            # 🔹 改為 show_pdf_page 疊加透明章
            page.show_pdf_page(rect, stamp_doc, 0)

    if not found_flag:
        print(f"{input_pdf} 沒有找到「報告簽署人」", file=sys.stderr)

    os.makedirs(output_folder, exist_ok=True)
    base_name = os.path.basename(input_pdf)
    output_pdf = os.path.join(output_folder, base_name)

    # 🔹 儲存時啟用壓縮與清理
    doc.save(
        output_pdf,
        deflate=True,
        garbage=4,
        clean=True,
        expand=False,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw=PASSWORD,
        user_pw="",
        permissions=fitz.PDF_PERM_PRINT + fitz.PDF_PERM_ACCESSIBILITY
    )
    doc.close()
    stamp_doc.close()  # 🔸 關閉暫存章檔
    os.remove(stamp_pdf)  # 🔸 刪除章 PDF

    # 建議測試時暫時保留原始 PDF，比較大小
    # os.remove(input_pdf)

    print(f"已完成 {output_pdf}", file=sys.stderr)
    return True

def main():
    if len(sys.argv) < 5:  # ← 需要 5 個參數
        print("0,0")  
        sys.exit(1)

    input_folder = sys.argv[1]
    output_folder = sys.argv[2]
    stamp_img = sys.argv[3]
    y_offset = int(sys.argv[4])   # ✅ 讀進來的第四個參數

    pdf_files = [f for f in os.listdir(input_folder) if f.lower().endswith(".pdf")]

    success, fail = 0, 0
    for pdf in pdf_files:
        input_pdf = os.path.join(input_folder, pdf)
        try:
            ok = add_stamp(input_pdf, stamp_img, output_folder, y_offset)
            if ok:
                success += 1
            else:
                fail += 1
        except Exception as e:
            print(f"處理 {pdf} 失敗：{e}", file=sys.stderr)
            fail += 1

    print(f"{success},{fail}")

if __name__ == "__main__":
    main()

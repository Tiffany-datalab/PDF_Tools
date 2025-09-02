APP_VERSION = "1.0.0"

import fitz  # PyMuPDF
import os
import sys

# 固定設定
STAMP_SIZE = 100
X_OFFSET = 360
Y_OFFSET = -25
PASSWORD = "HQTReport"

def add_stamp(input_pdf, stamp_img, output_folder):
    doc = fitz.open(input_pdf)
    found_flag = False

    for page_num, page in enumerate(doc, start=1):
        text_instances = page.search_for("報告簽署人")
        for inst in text_instances:
            found_flag = True
            x0, y0, x1, y1 = inst
            print(f"📍 {input_pdf} 第 {page_num} 頁 -> (x0={x0}, y0={y0}, x1={x1}, y1={y1})", file=sys.stderr)

            new_x = x0 + X_OFFSET
            new_y = y0 + Y_OFFSET
            rect = fitz.Rect(new_x, new_y, new_x + STAMP_SIZE, new_y + STAMP_SIZE)
            page.insert_image(rect, filename=stamp_img)

    if not found_flag:
        print(f"⚠️ {input_pdf} 沒有找到「報告簽署人」", file=sys.stderr)

    os.makedirs(output_folder, exist_ok=True)
    base_name = os.path.basename(input_pdf)
    output_pdf = os.path.join(output_folder, base_name)

    # 存檔（加密）
    doc.save(
        output_pdf,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw=PASSWORD,
        user_pw="",
        permissions=fitz.PDF_PERM_PRINT + fitz.PDF_PERM_ACCESSIBILITY,
        deflate=True,
        incremental=False,
        ascii=False
    )
    doc.close()

    os.remove(input_pdf)
    print(f"✅ 已完成 {output_pdf}，並刪除原始 {input_pdf}", file=sys.stderr)

    return True

def main():
    if len(sys.argv) < 4:
        print("0,0")  # 沒有參數 → 成功 0，失敗 0
        sys.exit(1)

    input_folder = sys.argv[1]
    output_folder = sys.argv[2]
    stamp_img = sys.argv[3]

    pdf_files = [f for f in os.listdir(input_folder) if f.lower().endswith(".pdf")]

    success, fail = 0, 0
    for pdf in pdf_files:
        input_pdf = os.path.join(input_folder, pdf)
        try:
            ok = add_stamp(input_pdf, stamp_img, output_folder)
            if ok:
                success += 1
            else:
                fail += 1
        except Exception as e:
            print(f"❌ 處理 {pdf} 失敗：{e}", file=sys.stderr)
            fail += 1

    # 最後統一輸出「成功數,失敗數」
    print(f"{success},{fail}")

if __name__ == "__main__":
    main()

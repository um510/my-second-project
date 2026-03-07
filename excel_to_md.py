import pandas as pd
from pathlib import Path
import sys
import re


def sanitize(name):
    return re.sub(r'[\\/:"*?<>|]+', '_', str(name))


def df_to_md(df):
    try:
        return df.to_markdown(index=False)
    except Exception:
        cols = df.columns.tolist()
        rows = df.fillna('').values.tolist()
        header = '| ' + ' | '.join(map(str, cols)) + ' |\n'
        sep = '| ' + ' | '.join(['---'] * len(cols)) + ' |\n'
        body = ''.join('| ' + ' | '.join(map(str, row)) + ' |\n' for row in rows)
        return header + sep + body


def main(path):
    p = Path(path)
    sheets = pd.read_excel(p, sheet_name=None, engine='openpyxl')
    out_dir = p.parent
    written = []
    for sheet_name, df in sheets.items():
        name = sanitize(sheet_name)
        md_text = df_to_md(df)
        out_name = f"{p.stem}_{name}.md"
        out_path = out_dir / out_name
        out_path.write_text(md_text, encoding='utf-8')
        written.append(str(out_path))
    for w in written:
        print('Wrote:', w)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python excel_to_md.py path/to/Book1.xlsx")
    else:
        main(sys.argv[1])

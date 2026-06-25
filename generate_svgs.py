import os

logos = ["ALTINS1","ARCLKNSE","AVTUR","BRMENNSE","DMLKTG","EKDMR","ISATR","ISGSY","ISYAT","UMPAS","VERTU"]
base_dir = r"c:\Users\muzaf\OneDrive\Belgeler\finans-app\bist_logo"

svg_template = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="#fcd535" rx="20"/>
  <text x="50" y="50" font-family="Arial" font-size="16" font-weight="bold" fill="#0b0e11" text-anchor="middle" dominant-baseline="central">{name}</text>
</svg>"""

for logo in logos:
    path = os.path.join(base_dir, f"{logo}.svg")
    with open(path, "w", encoding="utf-8") as f:
        short_name = logo[:8]
        f.write(svg_template.format(name=short_name))

import re

with open('styles.css', 'r', encoding='utf-8', errors='ignore') as f:
    css = f.read()

# 1. financeGrid grid layout
css = re.sub(r'\[data-theme="modern"\]\s*#financeGrid,\s*\[data-theme="modern"\]\s*#detailTabLineup\s*\{[\s\S]*?\}',
'''[data-theme="modern"] #detailTabLineup {
  display: flex !important;
  flex-direction: column !important;
}''', css)

css = re.sub(r'\[data-theme="modern"\]\s*#financeGrid,\s*\[data-theme="modern"\]\s*#coinlerList\s*\{[\s\S]*?\}',
'''[data-theme="modern"] #financeGrid,
[data-theme="modern"] #coinlerList {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: transparent;
}''', css)

# 2. market-row box styling
css = re.sub(r'\[data-theme="modern"\]\s*\.market-row,\s*\[data-theme="modern"\]\s*\.coin-row\s*\{[\s\S]*?\}',
'''[data-theme="modern"] .market-row,
[data-theme="modern"] .coin-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  background: rgba(30, 35, 41, 0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  margin: 0;
  min-height: 100px;
  transition: all 0.3s ease;
}''', css)

css = re.sub(r'\[data-theme="modern"\]\s*\.market-row:active,\s*\[data-theme="modern"\]\s*\.coin-row:active\s*\{[\s\S]*?\}',
'''[data-theme="modern"] .market-row:active,
[data-theme="modern"] .coin-row:active {
  background: rgba(255, 255, 255, 0.05);
  transform: scale(0.95);
  border-color: rgba(200, 255, 87, 0.3);
}''', css)

css = re.sub(r'\[data-theme="modern"\]\s*\.market-row:active\s*\{[\s\S]*?\}', '', css)

# 3. Inner elements
css = re.sub(r'\[data-theme="modern"\]\s*\.m-left\s*\{[\s\S]*?\}',
'''[data-theme="modern"] .m-left {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 12px;
}''', css)

css = re.sub(r'\[data-theme="modern"\]\s*\.m-middle\s*\{[\s\S]*?\}',
'''[data-theme="modern"] .m-middle {
  width: 100%;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px !important;
  font-weight: 800;
  color: var(--text-primary);
  text-align: left;
}''', css)

css = re.sub(r'\[data-theme="modern"\]\s*\.m-right\s*\{[\s\S]*?\}',
'''[data-theme="modern"] .m-right {
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-top: 8px;
}''', css)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print('Styles replaced successfully.')

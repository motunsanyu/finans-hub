import re

path = r'c:\Users\muzaf\OneDrive\Belgeler\finans-app\styles.css'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove anything related to time-modern-widget, tmw-, slideDown
content = re.sub(r'/\* ══════════════════════════════════════════\s+MODERN TIME WIDGET \(ZAMAN\)\s+══════════════════════════════════════════ \*/.*?(?=\s*/\*|$)', '', content, flags=re.DOTALL)
content = re.sub(r'\.time-modern-widget\s*\{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'\[data-theme="modern"\]\s*\.time-modern-widget\s*\{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'\.tmw-.*?\s*\{.*?\}', '', content, flags=re.DOTALL)
content = re.sub(r'@keyframes\s+slideDown\s*\{.*?\}', '', content, flags=re.DOTALL)

# Also clean up the accidentally inserted block at the top if it remains
content = re.sub(r'\[data-theme="modern"\]\s*\.tmw-header\s*\{.*?\}', '', content, flags=re.DOTALL)

new_styles = """
/* ══════════════════════════════════════════
   MODERN TIME WIDGET (ZAMAN)
   ══════════════════════════════════════════ */
.time-modern-widget {
  display: none;
}

[data-theme="modern"] .time-modern-widget {
  display: flex !important;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1c1e 0%, #0d0e10 100%);
  border-radius: 24px;
  padding: 24px;
  margin: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  align-items: center;
}

.tmw-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  text-align: center;
}

.tmw-clock {
  font-family: 'Space Mono', monospace;
  font-size: 42px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -2px;
  text-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
}

.tmw-date {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 4px;
}

.tmw-next-event {
  background: rgba(255, 255, 255, 0.03);
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  text-align: center;
  width: 100%;
  min-width: 250px;
}

.tmw-ne-label {
  font-size: 10px;
  font-weight: 800;
  color: var(--brand);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 8px;
}

.tmw-ne-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 4px;
}

.tmw-ne-days {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
"""

with open(path, 'w', encoding='utf-8') as f:
    f.write(content.strip() + "\n" + new_styles)

print("Styles cleaned and updated.")

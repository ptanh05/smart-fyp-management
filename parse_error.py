import re

with open('error.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

exc_type = re.search(r'<th>Exception Type:</th>\s*<td>(.*?)</td>', text, re.DOTALL)
exc_value = re.search(r'<pre class="exception_value">(.*?)</pre>', text, re.DOTALL)

if exc_type:
    print("Type:", exc_type.group(1).strip())
else:
    print("Type: Not found")
    
if exc_value:
    print("Value:", exc_value.group(1).strip())
else:
    print("Value: Not found")

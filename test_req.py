import urllib.request
import json
data = json.dumps({"registration_no": "201200101", "password": "student123"}).encode("utf-8")
req = urllib.request.Request("http://localhost:8000/app/student/login/", data=data, headers={"Content-Type": "application/json"})
try:
    urllib.request.urlopen(req)
    print("Success")
except Exception as e:
    with open("error.html", "w") as f:
        f.write(e.read().decode("utf-8", errors="ignore"))
    print("Failed")

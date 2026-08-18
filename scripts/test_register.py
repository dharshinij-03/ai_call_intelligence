import json
import urllib.request as request

url = "http://localhost:8003/auth/register"
payload = {
    "email": "dharshini@gmail.com",
    "password": "Pa$$w0rd123",
    "full_name": "Dharshini Test",
    "phone_number": "0000000000",
    "role": "citizen",
}

data = json.dumps(payload).encode()
req = request.Request(url, data=data, headers={"Content-Type": "application/json"})
try:
    with request.urlopen(req) as resp:
        print(resp.status)
        print(resp.read().decode())
except request.HTTPError as e:
    print('HTTPError', e.code)
    try:
        print(e.read().decode())
    except:
        pass
except Exception as e:
    print('Error:', e)

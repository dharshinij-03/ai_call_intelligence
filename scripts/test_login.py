import json
import urllib.request as request

# Test login
url = "http://localhost:8003/auth/login"
payload = "username=dharshini@gmail.com&password=Pa%24%24w0rd123"

req = request.Request(url, data=payload.encode(), headers={"Content-Type": "application/x-www-form-urlencoded"})
try:
    with request.urlopen(req) as resp:
        print('Login succeeded:', resp.status)
        print(resp.read().decode())
except request.HTTPError as e:
    print('HTTPError', e.code)
    try:
        print(e.read().decode())
    except:
        pass
except Exception as e:
    print('Error:', e)

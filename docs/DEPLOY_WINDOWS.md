# Deploy ConstructFlow tren Windows Server cong ty

Tai lieu nay dung cho ban v1: chay truc tiep bang Node.js tren Windows, dung Caddy lam HTTPS reverse proxy, va dung Windows Task Scheduler de app tu khoi dong lai.

## 1. Chuan bi server

- Windows server/PC bat 24/7, Internet on dinh.
- PowerShell chay voi quyen Administrator.
- Domain/subdomain: `app.ledome.vn`.
- IP public tinh hoac giai phap tunnel/DDNS neu cong ty khong co IP public tinh.

## Cai nhanh bang 1 lenh

Mo PowerShell bang quyen Administrator tren server, roi chay:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force; Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/ledome1/ledome/main/deploy/windows/install-server.ps1" -OutFile "$env:TEMP\install-constructflow.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\install-constructflow.ps1" -Domain "app.ledome.vn"
```

Lenh nay se tu dong:

- Cai Node.js 22 LTS neu server chua co Node.
- Tai app tu public GitHub repo `ledome1/ledome`.
- Tao Windows startup task `ConstructFlow`.
- Cai Caddy va tao Windows startup task `ConstructFlowCaddy`.
- Cau hinh `DATA_DIR=C:\ConstructFlow\data`, `BACKUP_DIR=C:\ConstructFlow\backups`, log tai `C:\ConstructFlow\logs`.
- Mo Windows Firewall cho port `80` va `443`.
- Smoke test `http://127.0.0.1:3000/api/v1/health`.

Mo firewall/router:

- Public `80 -> server:80`.
- Public `443 -> server:443`.
- Khong public port `3000`; port nay chi de Caddy goi noi bo `127.0.0.1:3000`.

## 2. Cau truc thu muc sau khi cai

```text
C:\ConstructFlow\
  app\       # code tai tu GitHub public repo
  data\      # runtime JSON va file upload, copy rieng tu may hien tai
  backups\   # backup do app tao
  logs\      # stdout/stderr cua app va Caddy
```

Khong commit `data/`, `backups/`, `logs/`, `.env`, password, token, ho so khach hang, hop dong, hoac file noi bo len GitHub. Voi ban hien tai chua co du lieu that trong repo, co the dung public repo de clone server don gian hon.

## 3. Bien moi truong production

Installer se thiet lap cac bien nay trong startup task `ConstructFlow`:

```powershell
NODE_ENV=production
PORT=3000
DATA_DIR=C:\ConstructFlow\data
BACKUP_DIR=C:\ConstructFlow\backups
UPLOAD_MAX_BYTES=104857600
SESSION_TTL_HOURS=12
```

`UPLOAD_MAX_BYTES=104857600` tuong duong 100 MB.

## 4. Cai thu cong neu khong dung 1 lenh

Tren server:

```powershell
New-Item -ItemType Directory -Force C:\ConstructFlow\app,C:\ConstructFlow\data,C:\ConstructFlow\backups,C:\ConstructFlow\logs
git clone https://github.com/<OWNER>/<PUBLIC_REPO>.git C:\ConstructFlow\app
```

Neu repo sau nay chuyen ve private, server can cau hinh lai GitHub authentication bang SSH key, deploy key, GitHub CLI, hoac personal access token truoc khi `git pull`.

Copy thu muc `C:\fastcome\data` hien tai sang `C:\ConstructFlow\data` tren server bang USB, robocopy, hoac file zip noi bo. Khong day thu muc `data` len public repo.

Vi du neu copy qua mang noi bo:

```powershell
robocopy C:\fastcome\data C:\ConstructFlow\data /MIR
```

## 5. Startup tasks

Installer tao 2 Windows Scheduled Tasks chay bang user `SYSTEM`:

- `ConstructFlow`: chay Node app o port `3000`.
- `ConstructFlowCaddy`: chay Caddy reverse proxy cho `app.ledome.vn`.

Neu can restart thu cong:

```powershell
Stop-ScheduledTask -TaskName ConstructFlow -ErrorAction SilentlyContinue
Stop-ScheduledTask -TaskName ConstructFlowCaddy -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName ConstructFlow
Start-ScheduledTask -TaskName ConstructFlowCaddy
```

Kiem tra app noi bo:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/v1/health
```

Truoc khi mo public, dang nhap noi bo va doi mat khau cho tat ca tai khoan trong muc Cau hinh > Tai khoan. Khong de bat ky tai khoan nao dung mat khau mac dinh/yeu nhu `1`.

## 6. Cau hinh Caddy HTTPS

Dung file mau `deploy/windows/Caddyfile.example`, hoac them vao Caddyfile:

```caddyfile
app.ledome.vn {
  encode gzip
  reverse_proxy 127.0.0.1:3000
}
```

Reload Caddy sau khi DNS `app.ledome.vn` da tro ve IP public cong ty.

## 7. Smoke test sau deploy

```powershell
Invoke-RestMethod https://app.ledome.vn/api/v1/health
```

Kiem tra tren trinh duyet:

- Mo `https://app.ledome.vn`.
- Dang nhap.
- Goi thu `https://app.ledome.vn/api/v1/projects` khi chua dang nhap phai tra `401`.
- Upload/download file du an.
- Restart task `ConstructFlow`, dang nhap lai va xac nhan data van con.
- Chay backup trong app va xac nhan co ban sao trong `C:\ConstructFlow\backups`.

## 8. Cap nhat app sau nay bang 1 lenh

Chay lai lenh cai nhanh. Installer se tai code moi nhat tu GitHub, cap nhat `C:\ConstructFlow\app`, restart startup tasks, va giu nguyen `C:\ConstructFlow\data`.

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force; Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/ledome1/ledome/main/deploy/windows/install-server.ps1" -OutFile "$env:TEMP\install-constructflow.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\install-constructflow.ps1" -Domain "app.ledome.vn"
```

Neu co thay doi lien quan data, backup `C:\ConstructFlow\data` truoc khi chay lai installer.

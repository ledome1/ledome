$env:NODE_ENV = "production"
$env:PORT = "3000"
$env:DATA_DIR = "C:\Ledome-MGMT\data"
$env:BACKUP_DIR = "C:\Ledome-MGMT\backups"
$env:UPLOAD_MAX_BYTES = "104857600"
$env:SESSION_TTL_HOURS = "12"

node server.js
